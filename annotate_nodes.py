import cv2
import json
import os
from dataclasses import dataclass

# ---------- CONFIG ----------
MAP_IMAGE_PATH = "client/public/map.jpeg"              # <-- change to your map image filename
STATIONS_PATH = "stations.txt"
OUTPUT_PATH = "node_positions.json"

WINDOW_NAME = "Scotland Yard Node Annotator"
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.7
THICKNESS = 2

# Visual radius of marker circle
MARKER_R = 6


@dataclass
class Station:
    id: int
    raw_x: int
    raw_y: int
    types: list


def load_stations(path: str) -> list[Station]:
    stations = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            sid = int(parts[0])
            x = int(parts[1])
            y = int(parts[2])
            types = parts[3].split(",")
            stations.append(Station(sid, x, y, types))
    stations.sort(key=lambda s: s.id)
    return stations


def load_progress(path: str) -> dict:
    if not os.path.exists(path):
        return {"positions": {}, "skipped": [], "meta": {}}
    with open(path, "r") as f:
        return json.load(f)


def save_progress(path: str, progress: dict):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(progress, f, indent=2)
    os.replace(tmp, path)


def draw_ui(img, station: Station, idx: int, total: int, progress: dict, message: str = ""):
    out = img.copy()

    # Draw all saved positions
    for sid_str, p in progress["positions"].items():
        x, y = int(p["x"]), int(p["y"])
        cv2.circle(out, (x, y), MARKER_R, (0, 255, 0), -1)
        cv2.putText(out, sid_str, (x + 8, y - 8), FONT, 0.6, (0, 255, 0), 2, cv2.LINE_AA)

    # Header
    header = f"Station {station.id}  ({idx+1}/{total})   Types: {','.join(station.types)}"
    cv2.rectangle(out, (0, 0), (out.shape[1], 70), (0, 0, 0), -1)
    cv2.putText(out, header, (15, 30), FONT, FONT_SCALE, (255, 255, 255), THICKNESS, cv2.LINE_AA)

    # Instructions
    instr = "LClick=set  u=undo  s=skip  j=jump  m=move-id  r=reload  q=quit"
    cv2.putText(out, instr, (15, 60), FONT, 0.6, (200, 200, 200), 1, cv2.LINE_AA)

    # Message line
    if message:
        cv2.rectangle(out, (0, out.shape[0]-40), (out.shape[1], out.shape[0]), (0, 0, 0), -1)
        cv2.putText(out, message, (15, out.shape[0]-12), FONT, 0.6, (0, 255, 255), 2, cv2.LINE_AA)

    return out


def find_next_unset_index(stations: list[Station], progress: dict, start_idx=0):
    positions = progress["positions"]
    skipped = set(progress["skipped"])
    for i in range(start_idx, len(stations)):
        sid = stations[i].id
        if str(sid) not in positions and sid not in skipped:
            return i
    return None


def main():
    stations = load_stations(STATIONS_PATH)
    if not stations:
        print("No stations found in stations.txt")
        return

    map_img = cv2.imread(MAP_IMAGE_PATH)
    if map_img is None:
        print(f"Could not load map image: {MAP_IMAGE_PATH}")
        return

    progress = load_progress(OUTPUT_PATH)
    progress.setdefault("positions", {})
    progress.setdefault("skipped", [])
    progress.setdefault("meta", {})
    progress["meta"]["map_image"] = MAP_IMAGE_PATH
    progress["meta"]["stations_file"] = STATIONS_PATH
    progress["meta"]["map_size"] = {"w": map_img.shape[1], "h": map_img.shape[0]}

    # Start at first unset station
    current_idx = find_next_unset_index(stations, progress, 0)
    if current_idx is None:
        print("All stations already set (or skipped). Nothing to do.")
        return

    history = []  # stack of station indices set in order
    message = ""

    # Mouse callback uses these mutable holders
    state = {
        "clicked": False,
        "click_pos": None
    }

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            state["clicked"] = True
            state["click_pos"] = (x, y)

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(WINDOW_NAME, on_mouse)

    while True:
        station = stations[current_idx]
        ui = draw_ui(map_img, station, current_idx, len(stations), progress, message)
        cv2.imshow(WINDOW_NAME, ui)

        key = cv2.waitKey(20) & 0xFF

        # Handle click to set current station
        if state["clicked"]:
            x, y = state["click_pos"]
            progress["positions"][str(station.id)] = {"x": int(x), "y": int(y)}
            save_progress(OUTPUT_PATH, progress)
            history.append(current_idx)

            message = f"Set station {station.id} -> ({x},{y})"

            state["clicked"] = False
            state["click_pos"] = None

            nxt = find_next_unset_index(stations, progress, current_idx + 1)
            if nxt is None:
                message = "DONE: all stations set or skipped. Press q to quit."
            else:
                current_idx = nxt
            continue

        # Quit
        if key == ord("q"):
            break

        # Undo last set station
        if key == ord("u"):
            if not history:
                message = "Nothing to undo."
                continue
            last_idx = history.pop()
            last_station = stations[last_idx]
            progress["positions"].pop(str(last_station.id), None)
            save_progress(OUTPUT_PATH, progress)
            current_idx = last_idx
            message = f"Undid station {last_station.id}. Click again to set."
            continue

        # Skip current station (mark as skipped)
        if key == ord("s"):
            sid = station.id
            if sid not in progress["skipped"]:
                progress["skipped"].append(sid)
                save_progress(OUTPUT_PATH, progress)
            message = f"Skipped station {sid}."
            nxt = find_next_unset_index(stations, progress, current_idx + 1)
            if nxt is None:
                message = "DONE: all stations set or skipped. Press q to quit."
            else:
                current_idx = nxt
            continue

        # Jump to station ID
        if key == ord("j"):
            try:
                target = int(input("Jump to station ID: ").strip())
            except ValueError:
                message = "Invalid station ID."
                continue

            idx_lookup = {s.id: i for i, s in enumerate(stations)}
            if target not in idx_lookup:
                message = f"Station ID {target} not found."
                continue

            current_idx = idx_lookup[target]
            message = f"Jumped to station {target}."
            continue

        # Move an already-set station (pick ID, then click)
        if key == ord("m"):
            try:
                target = int(input("Move station ID: ").strip())
            except ValueError:
                message = "Invalid station ID."
                continue

            if str(target) not in progress["positions"]:
                message = f"Station {target} has no saved position yet."
                continue

            idx_lookup = {s.id: i for i, s in enumerate(stations)}
            if target not in idx_lookup:
                message = f"Station ID {target} not found."
                continue

            current_idx = idx_lookup[target]
            message = f"Click new position for station {target}."
            # next left-click overwrites the existing position
            continue

        # Reload progress from disk
        if key == ord("r"):
            progress = load_progress(OUTPUT_PATH)
            progress.setdefault("positions", {})
            progress.setdefault("skipped", [])
            message = "Reloaded progress from disk."
            # move to first unset from current position
            nxt = find_next_unset_index(stations, progress, current_idx)
            if nxt is None:
                message = "DONE: all stations set or skipped. Press q to quit."
            else:
                current_idx = nxt
            continue

    cv2.destroyAllWindows()
    print(f"Saved to: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()


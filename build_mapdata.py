import json
import sys

STATIONS_PATH = "stations.txt"
CONNECTIONS_PATH = "connections.txt"
POSITIONS_PATH = "node_positions.json"
OUTPUT_PATH = "shared/mapData.json"

# If False: crash if any station is missing a clicked position.
# If True: stations with missing positions are excluded.
ALLOW_MISSING_POSITIONS = False

# If True: stations listed under "skipped" in node_positions.json are excluded.
DROP_SKIPPED = True


def load_stations(path):
    """
    stations.txt format:
    ID X Y TYPE(S)
    Example: 1 123 456 taxi,bus
    """
    stations = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            sid = int(parts[0])
            types = parts[3].split(",")
            stations[sid] = {"id": sid, "types": types}
    return stations


def load_connections(path):
    """
    connections.txt format:
    FROM TO TRANSPORT
    Example: 1 2 taxi
    """
    edges = []
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 3:
                continue
            u = int(parts[0])
            v = int(parts[1])
            t = parts[2]
            edges.append((u, v, t))
    return edges


def load_positions(path):
    """
    node_positions.json format:
    {
      "positions": {"1": {"x":..., "y":...}, ...},
      "skipped": [ ... ],
      ...
    }
    """
    with open(path, "r") as f:
        data = json.load(f)

    positions = data.get("positions", {})
    skipped = set(data.get("skipped", []))

    # normalize keys -> int
    pos_int = {}
    for k, v in positions.items():
        try:
            sid = int(k)
        except ValueError:
            continue
        pos_int[sid] = {"x": int(v["x"]), "y": int(v["y"])}

    return pos_int, skipped


def build_map_data(stations, edges, positions, skipped):
    nodes = {}

    # Build nodes from stations + clicked positions
    missing = []
    for sid, sdata in stations.items():
        if DROP_SKIPPED and sid in skipped:
            continue

        if sid not in positions:
            missing.append(sid)
            if ALLOW_MISSING_POSITIONS:
                continue
            else:
                # defer error until after we list them all
                continue

        nodes[sid] = {
            "id": sid,
            "x": positions[sid]["x"],
            "y": positions[sid]["y"],
            "types": sdata["types"],
            "edges": []
        }

    if missing and not ALLOW_MISSING_POSITIONS:
        missing_str = ", ".join(map(str, missing[:50]))
        extra = "" if len(missing) <= 50 else f" ... (+{len(missing)-50} more)"
        raise RuntimeError(
            f"Missing clicked positions for {len(missing)} station(s): {missing_str}{extra}\n"
            f"Fix: annotate them or set ALLOW_MISSING_POSITIONS=True."
        )

    # Add undirected edges
    for u, v, t in edges:
        if u in nodes and v in nodes:
            nodes[u]["edges"].append({"to": v, "type": t})
            nodes[v]["edges"].append({"to": u, "type": t})

    return {"nodes": nodes}


def main():
    stations = load_stations(STATIONS_PATH)
    edges = load_connections(CONNECTIONS_PATH)
    positions, skipped = load_positions(POSITIONS_PATH)

    map_data = build_map_data(stations, edges, positions, skipped)

    # Optional: sort edges for determinism (nice for diffs)
    for node in map_data["nodes"].values():
        node["edges"].sort(key=lambda e: (e["to"], e["type"]))

    with open(OUTPUT_PATH, "w") as f:
        json.dump(map_data, f, indent=2)

    print(f"OK: wrote {len(map_data['nodes'])} nodes -> {OUTPUT_PATH}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


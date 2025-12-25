import json

MAP_W = 2849
MAP_H = 2235

def parse_scotland_yard_data(stations_path, connections_path, output_path, flip_y=False):
    raw_nodes = {}   # store original coords first

    # --- 1) Read stations (raw) ---
    with open(stations_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 4:
                continue

            node_id = int(parts[0])
            x = int(parts[1])
            y = int(parts[2])
            types = parts[3].split(",")

            raw_nodes[node_id] = {"id": node_id, "x": x, "y": y, "types": types, "edges": []}

    if not raw_nodes:
        raise RuntimeError("No stations parsed.")

    # --- 2) Compute bounding box ---
    xs = [n["x"] for n in raw_nodes.values()]
    ys = [n["y"] for n in raw_nodes.values()]

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    data_w = max_x - min_x
    data_h = max_y - min_y

    if data_w == 0 or data_h == 0:
        raise RuntimeError("Station coordinate range is zero (invalid data).")

    # --- 3) Compute uniform scale that fits in map ---
    scale = min(MAP_W / data_w, MAP_H / data_h)

    # size of scaled data
    scaled_w = data_w * scale
    scaled_h = data_h * scale

    # center padding
    pad_x = (MAP_W - scaled_w) / 2
    pad_y = (MAP_H - scaled_h) / 2

    # --- 4) Apply transform ---
    nodes = {}
    for node_id, n in raw_nodes.items():
        x = (n["x"] - min_x) * scale + pad_x
        y = (n["y"] - min_y) * scale + pad_y

        if flip_y:
            y = MAP_H - y

        nodes[node_id] = {
            "id": node_id,
            "x": int(round(x)),
            "y": int(round(y)),
            "types": n["types"],
            "edges": []
        }

    # --- 5) Parse connections ---
    with open(connections_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 3:
                continue

            u, v, transport = int(parts[0]), int(parts[1]), parts[2]

            if u in nodes:
                nodes[u]["edges"].append({"to": v, "type": transport})
            if v in nodes:
                nodes[v]["edges"].append({"to": u, "type": transport})

    # --- 6) Export ---
    with open(output_path, "w") as f:
        json.dump({
            "mapSize": {"width": MAP_W, "height": MAP_H},
            "transform": {
                "minX": min_x, "maxX": max_x,
                "minY": min_y, "maxY": max_y,
                "scale": scale,
                "padX": pad_x, "padY": pad_y,
                "flipY": flip_y
            },
            "nodes": nodes
        }, f, indent=2)

    print(f"Processed {len(nodes)} nodes")
    print(f"Data bounds: X[{min_x},{max_x}] Y[{min_y},{max_y}]")
    print(f"Scale={scale:.6f}, padX={pad_x:.2f}, padY={pad_y:.2f}, flipY={flip_y}")
    print(f"Output: {output_path}")

if __name__ == "__main__":
    parse_scotland_yard_data("stations.txt", "connections.txt", "shared/mapData.json", flip_y=False)

import os
import json

def bundle():
    dataset_dir = "dataset"
    output_dir = "kdance/src/assets"
    output_file = os.path.join(output_dir, "dance_db.json")
    
    if not os.path.exists(dataset_dir):
        print(f"Error: {dataset_dir} folder not found.")
        return

    os.makedirs(output_dir, exist_ok=True)
    
    bundled_data = []
    if os.path.exists(dataset_dir):
        for file in os.listdir(dataset_dir):
            if file.endswith("_data.json"):
                file_path = os.path.join(dataset_dir, file)
                print(f"Reading {file}...")
                try:
                    with open(file_path, 'r') as f:
                        bundled_data.append(json.load(f))
                except Exception as e:
                    print(f"Error reading {file}: {e}")
    
    with open(output_file, 'w') as f:
        json.dump(bundled_data, f)
    
    print(f"Successfully bundled {len(bundled_data)} sessions into {output_file}")

if __name__ == "__main__":
    bundle()

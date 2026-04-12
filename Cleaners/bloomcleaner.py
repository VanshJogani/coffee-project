import pandas as pd
import re

def clean_dataset(input_file, output_file):
    # Load raw data
    df = pd.read_csv(input_file)

    # Prepare new DataFrame with required columns
    cleaned = pd.DataFrame(columns=[
        "Name", "Roaster", "Price", "Quantity",
        "Roast_Level", "Tasting_Notes", "Desc", "URL"
    ])

    for _, row in df.iterrows():
        product_name = str(row["product_name"])
        vendor = str(row["vendor"])
        price = row["price"]

        # Extract Roast Level (e.g., "Medium Roast")
        roast_match = re.search(r"(Light Roast|Medium Roast|Dark Roast)", product_name, re.IGNORECASE)
        roast_level = roast_match.group(0) if roast_match else ""

        # Extract Quantity (e.g., "250gms")
        qty_match = re.search(r"(\d+\s?gms|\d+\s?kg)", product_name, re.IGNORECASE)
        quantity = qty_match.group(0) if qty_match else ""

        # Extract Name (remove roast and qty info)
        name = product_name
        if roast_level:
            name = name.replace(roast_level, "")
        if quantity:
            name = name.replace(quantity, "")
        name = re.sub(r"[-/]", "", name).strip()

        cleaned = pd.concat([cleaned, pd.DataFrame([{
            "Name": name.strip(),
            "Roaster": vendor,
            "Price": price,
            "Quantity": quantity,
            "Roast_Level": roast_level,
            "Tasting_Notes": "",
            "Desc": "",
            "URL": ""
        }])], ignore_index=True)

    # Save cleaned CSV
    cleaned.to_csv(output_file, index=False)
    print(f"✅ Cleaned dataset saved to {output_file}")


# Example usage:
clean_dataset("bloom_meta_products.csv", "clean/bloom_clean_products.csv")

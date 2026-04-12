from pathlib import Path
from pipeline.parser import GenericRoastersParser
import os

def test_tulum():
    # Use a dummy names set
    parser = GenericRoastersParser(Path("ScraperScripts/coffeeroastersupdated.txt"), already_scraped_names=set())
    
    # Test only Tulum
    name = "Tulum"
    url = "https://www.tulum.coffee/collections/all"
    output_dir = Path("results/test_tulum")
    
    csv_path = parser.parse_single_roaster(name, url, output_dir)
    print(f"Scraped CSV: {csv_path}")

if __name__ == "__main__":
    test_tulum()

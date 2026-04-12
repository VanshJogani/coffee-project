import asyncio
import pandas as pd
from playwright.async_api import async_playwright
import os

async def scrape_ainmane():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://www.ainmane.com/coffee.html"
        print(f"Opening {url}...")
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(10000)
            
            # Save screenshot for diagnosis
            await page.screenshot(path="ainmane_diag.png")
            
            # Magento selectors
            product_elements = await page.query_selector_all(".item.product.product-item, .product-item, [role='listitem']")
            print(f"Found {len(product_elements)} product elements.")
            
            product_links = []
            for el in product_elements:
                a = await el.query_selector("a.product-item-link, a")
                if a:
                    href = await a.get_attribute("href")
                    if href and "/coffee.html" not in href:
                        product_links.append(href)
            
            product_links = list(set(product_links))
            print(f"Unique product links: {len(product_links)}")
            
            products = []
            for i, link in enumerate(product_links, 1):
                try:
                    await page.goto(link, wait_until="domcontentloaded")
                    await page.wait_for_timeout(3000)
                    
                    name_el = await page.query_selector("h1.page-title span.base")
                    name = await name_el.inner_text() if name_el else "Unknown"
                    
                    price_el = await page.query_selector(".price-wrapper .price, .price")
                    price = await price_el.inner_text() if price_el else ""
                    
                    desc_el = await page.query_selector(".product.attribute.description .value, #description")
                    desc = await desc_el.inner_text() if desc_el else ""
                    
                    img_el = await page.query_selector(".gallery-placeholder img, .product img")
                    img_url = await img_el.get_attribute("src") if img_el else ""
                    
                    products.append({
                        "roaster": "Ainmane",
                        "name": name.strip(),
                        "price": price.strip(),
                        "currency": "INR",
                        "description": desc.strip(),
                        "product_url": link,
                        "image_url": img_url,
                        "variants": ""
                    })
                except Exception as e:
                    print(f"    Error scraping {link}: {e}")
            
            await browser.close()
            return products
        except Exception as e:
            print(f"Error scraping Ainmane: {e}")
            await browser.close()
            return []

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    products = loop.run_until_complete(scrape_ainmane())
    
    if products:
        df = pd.DataFrame(products)
        output_path = "ainmane_products_generic.csv"
        df.to_csv(output_path, index=False)
        print(f"✅ Saved {len(df)} products to {output_path}")
    else:
        print("❌ No products found.")

import asyncio
import pandas as pd
from playwright.async_api import async_playwright
import os

async def scrape_alchemist():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://alchemistroastery.com/shop"
        print(f"Opening {url}...")
        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)
        
        # Scroll to load all products
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await asyncio.sleep(2)
        
        # Selectors from research
        # Product Container: [data-aid="GRID_ITEM_RENDERED"]
        # Product Link: a[href^='/shop/ols/products/']
        
        product_elements = await page.query_selector_all("[data-aid='GRID_ITEM_RENDERED']")
        if not product_elements:
            print("Trying fallback selector for products...")
            product_elements = await page.query_selector_all("a[href*='/shop/ols/products/']")
        
        print(f"Found {len(product_elements)} product elements.")
        
        product_links = []
        for el in product_elements:
            href = await el.get_attribute("href")
            if not href:
                a = await el.query_selector("a[href^='/shop/ols/products/']")
                if a:
                    href = await a.get_attribute("href")
            
            if href:
                full_link = f"https://alchemistroastery.com{href}" if href.startswith("/") else href
                product_links.append(full_link)
        
        product_links = list(set(product_links))
        print(f"Unique product links: {len(product_links)}")
        
        products = []
        for i, link in enumerate(product_links, 1):
            print(f"  [{i}/{len(product_links)}] Scraping {link}...")
            try:
                await page.goto(link, wait_until="domcontentloaded")
                await page.wait_for_timeout(3000)
                
                name_el = await page.query_selector("[data-aid='PRODUCT_NAME']")
                name = await name_el.inner_text() if name_el else "Unknown"
                
                price_el = await page.query_selector("[data-aid='PRODUCT_PRICE']")
                price = await price_el.inner_text() if price_el else ""
                
                desc_el = await page.query_selector("[data-aid='PRODUCT_DESCRIPTION']")
                desc = await desc_el.inner_text() if desc_el else ""
                
                img_el = await page.query_selector("[data-aid='PRODUCT_IMAGE_RENDERED'] img")
                img_url = await img_el.get_attribute("src") if img_el else ""
                
                products.append({
                    "roaster": "Alchemist",
                    "name": name.strip(),
                    "price": price.strip(),
                    "currency": "INR",
                    "description": desc.strip(),
                    "product_url": link,
                    "image_url": img_url,
                    "variants": "" # Mostly bags or accessories
                })
            except Exception as e:
                print(f"    Error: {e}")
        
        await browser.close()
        return products

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    products = loop.run_until_complete(scrape_alchemist())
    
    if products:
        df = pd.DataFrame(products)
        output_path = "alchemist_products_generic.csv"
        df.to_csv(output_path, index=False)
        print(f"✅ Saved {len(df)} products to {output_path}")
    else:
        print("❌ No products found.")

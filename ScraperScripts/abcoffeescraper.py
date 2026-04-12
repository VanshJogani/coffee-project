import asyncio
import pandas as pd
from playwright.async_api import async_playwright
import os

async def scrape_abcoffee():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        url = "https://www.abcoffee.in/shop"
        print(f"Opening {url}...")
        try:
            await page.goto(url, wait_until="domcontentloaded")
            await page.wait_for_timeout(10000)
            
            # Find all links on the page
            links_els = await page.query_selector_all("a")
            product_links = []
            for el in links_els:
                href = await el.get_attribute("href")
                if href and ("/products/" in href or "/shop/ols/products/" in href):
                    full_link = f"https://www.abcoffee.in{href}" if href.startswith("/") else href
                    product_links.append(full_link)
            
            product_links = list(set(product_links))
            print(f"Found {len(product_links)} unique product links.")
            
            products = []
            for i, link in enumerate(product_links, 1):
                if "/shop" == link or link.endswith("/shop/"): continue
                print(f"  [{i}/{len(product_links)}] Scraping {link}...")
                try:
                    await page.goto(link, wait_until="domcontentloaded")
                    await page.wait_for_timeout(5000)
                    
                    name_el = await page.query_selector("h1, h2, h3, h4")
                    name = await name_el.inner_text() if name_el else "Unknown"
                    
                    # Try to find price
                    price = ""
                    price_els = await page.query_selector_all("span, div, p")
                    for el in price_els:
                        try:
                            txt = (await el.inner_text()).strip()
                            if ("₹" in txt or "Rs" in txt) and len(txt) < 20:
                                price = txt
                                break
                        except: pass
                    
                    img_el = await page.query_selector("img")
                    img_url = await img_el.get_attribute("src") if img_el else ""
                    
                    products.append({
                        "roaster": "A B Coffee",
                        "name": name.strip(),
                        "price": price.strip(),
                        "currency": "INR",
                        "description": "", 
                        "product_url": link,
                        "image_url": img_url,
                        "variants": ""
                    })
                except Exception as e:
                    print(f"    Error on {link}: {e}")
            
            await browser.close()
            return products
        except Exception as e:
            print(f"Error: {e}")
            await browser.close()
            return []

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    products = loop.run_until_complete(scrape_abcoffee())
    
    if products:
        df = pd.DataFrame(products)
        output_path = "a_b_coffee_products_generic.csv"
        df.to_csv(output_path, index=False)
        print(f"✅ Saved {len(df)} products to {output_path}")
    else:
        print("❌ No products found.")

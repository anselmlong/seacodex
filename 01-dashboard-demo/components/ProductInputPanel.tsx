"use client";

import { ImagePlus, Link, PackageSearch } from "lucide-react";
import type { ProductListing } from "../lib/types";

type ProductInputPanelProps = {
  product: ProductListing;
  onChange: (product: ProductListing) => void;
};

export function ProductInputPanel({ product, onChange }: ProductInputPanelProps) {
  const update = <Key extends keyof ProductListing>(key: Key, value: ProductListing[Key]) => {
    onChange({ ...product, [key]: value });
  };

  return (
    <section className="listing-panel" aria-label="Product listing input">
      <details>
        <summary>
          <span>
            <PackageSearch size={16} />
            Listing details
          </span>
          <small>Edit title, price, and copy</small>
        </summary>
        <div className="listing-grid">
          <label className="field wide">
            <span>Product name</span>
            <input value={product.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label className="field">
            <span>Category</span>
            <input value={product.category} onChange={(event) => update("category", event.target.value)} />
          </label>
          <label className="field">
            <span>Price SGD</span>
            <input
              min={1}
              type="number"
              value={product.priceSgd}
              onChange={(event) => update("priceSgd", Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span>Discount %</span>
            <input
              min={0}
              max={90}
              type="number"
              value={product.discountPercent}
              onChange={(event) => update("discountPercent", Number(event.target.value))}
            />
          </label>
          <label className="field wide">
            <span>
              <Link size={14} />
              Shopee link
            </span>
            <input value={product.shopeeUrl} onChange={(event) => update("shopeeUrl", event.target.value)} />
          </label>
          <label className="field wide">
            <span>Listing headline</span>
            <input value={product.headline} onChange={(event) => update("headline", event.target.value)} />
          </label>
          <label className="field wide">
            <span>Description</span>
            <textarea value={product.description} onChange={(event) => update("description", event.target.value)} />
          </label>
          <label className="field wide">
            <span>
              <ImagePlus size={14} />
              Image URL
            </span>
            <input
              placeholder="Paste image URL or leave demo visual"
              value={product.imageUrl}
              onChange={(event) => update("imageUrl", event.target.value)}
            />
          </label>
        </div>
      </details>
    </section>
  );
}

import { ShoppingBag } from "lucide-react";
import type { ProductListing } from "../lib/types";

type ProductPreviewProps = {
  product: ProductListing;
};

export function ProductPreview({ product }: ProductPreviewProps) {
  return (
    <section className="product-preview" aria-label="Product preview">
      <div className="preview-image">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={`${product.name} listing preview`} src={product.imageUrl} />
        ) : (
          <div className="demo-product-art">
            <ShoppingBag size={42} />
            <span>11.11</span>
          </div>
        )}
      </div>
      <div className="preview-copy">
        <span>Shopee listing draft</span>
        <h2>{product.headline}</h2>
        <p>{product.description}</p>
        <strong>${product.priceSgd.toFixed(2)} SGD</strong>
      </div>
    </section>
  );
}

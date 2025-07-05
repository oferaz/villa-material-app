import pandas as pd
from sentence_transformers import SentenceTransformer

import numpy as np
import pickle

# Load product data
df = pd.read_csv("/home/ofer/LLM/DB/Adjusted_Product_Catalog.csv")
df = df.dropna(subset=["product_name"])

# Load the sentence transformer model
model = SentenceTransformer("/home/ofer/LLM/models/all-MiniLM-L6-v2")

# Generate embeddings
product_names = df["product_name"].tolist()
embeddings = model.encode(product_names, convert_to_numpy=True)

# Add embeddings to DataFrame
df["embedding"] = list(embeddings)

# Save to a Pickle file (preserves the numpy vectors)
df.to_pickle("product_catalog_with_embeddings.pkl")

print("✅ Embeddings generated and saved to 'product_catalog_with_embeddings.pkl'")

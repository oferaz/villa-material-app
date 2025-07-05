# ui_utils.py

import streamlit as st

def inject_custom_css():
    st.markdown(
        """
        <style>
        .stApp {
            background-color: #f8f9fa;
            font-family: "Segoe UI", sans-serif;
        }

        .main > div {
            background-color: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            margin-bottom: 1rem;
        }

        .stTextInput, .stNumberInput, .stSelectbox, .stTextArea, .stFileUploader, .stMultiSelect {
            padding: 0.5rem;
            border-radius: 0.5rem;
        }

        .stButton > button {
            background-color: #0072C6;
            color: white;
            border-radius: 0.5rem;
            padding: 0.4rem 1rem;
            border: none;
            transition: background-color 0.3s ease;
        }

        .stButton > button:hover {
            background-color: #005A9E;
        }

        .stDownloadButton > button {
            border-radius: 0.5rem;
        }

        img {
            border-radius: 12px;
            max-height: 250px;
            object-fit: cover;
        }

        .product-card {
            border: 1px solid #ddd;
            border-radius: 10px;
            padding: 1rem;
            margin-bottom: 1rem;
            box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        }
        </style>
        """,
        unsafe_allow_html=True
    )

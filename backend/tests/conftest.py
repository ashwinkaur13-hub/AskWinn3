"""Shared pytest fixtures and env loading for all backend test suites."""
import os
from dotenv import load_dotenv

# Load env vars before any test module imports use them
load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")

import requests
import json
import re

API_ID = "3454"
API_KEY = "zb3frnIJevoBNQQWiTEFp7ExqofD5vRr"

# Search for the order by querying recent order IDs (e.g. range around last known or just polling active)
# Let's inspect getstatus for order_id by testing range from 5000000 to find the order with matiascalderonlykh@outlook.com
# Or we can check litensi profile / log
r = requests.post("https://litensi.id/api/profile", data={"api_id": API_ID, "api_key": API_KEY})
print("Profile:", r.json())

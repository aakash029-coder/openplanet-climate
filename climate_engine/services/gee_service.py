import random

async def generate_spatial_hexgrid(lat: float, lng: float) -> list:
    # Proxy visualization for the 3D map until GEE API is hooked up
    hex_grid = []
    for _ in range(3000):
        lat_offset = random.gauss(0, 0.04)
        lng_offset = random.gauss(0, 0.04)
        hex_grid.append({"position": [lng + lng_offset, lat + lat_offset]})
    return hex_grid
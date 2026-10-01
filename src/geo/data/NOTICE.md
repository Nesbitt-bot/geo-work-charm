# OpenStreetMap regional extracts

The Beijing, Shanghai and Shenzhen GeoJSON files contain real OpenStreetMap
roads, paths, building outlines and named places around the demo workplaces.
They are bounded extracts, not complete city maps. Missing names/outlines reflect
OSM coverage; this project does not invent building identities.

© OpenStreetMap contributors. Database content is provided under the
Open Data Commons Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright
https://opendatacommons.org/licenses/odbl/1-0/

Each file records its bounding box and OSM data timestamp. To reproduce/update
the extracts, run `node scripts/download-streets.mjs --refresh` with an internet connection.
The script queries the public Overpass endpoint in small bounded requests.
App MIT licensing does not replace the OSM database license.

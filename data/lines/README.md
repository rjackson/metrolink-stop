# lines.json

Transport for Greater Manchester (TfGM) do not appear to publish a simple list of Metrolink lines, and the stops that serve each line.

They publish the following customer-facing resources:

- The list of lines on their [Live tram updates](https://tfgm.com/public-transport/tram) page (and its [underlying API endpoint](https://tfgm.com/api/statuses/tram))
- [Greater Manchester tram network map](https://tfgm.com/public-transport/tram/network-map) ("map")

From which an association can be manually curated.

Alternatively, on they publish a General Transit Feed Specification (GTFS) dataset for all public transport available in Greater Manchester, including Metrolink: [GM Public Transport Schedules – GTFS dataset](https://data.gov.uk/dataset/c3ca6469-7955-4a57-8bfc-58ef2361b797/gm-public-transport-schedules-gtfs-dataset). This will be very close to the feed that Google Maps receives (they'll have a [Realtime](https://developers.google.com/transit/gtfs-realtime) variant).

One downside of this GTFS feed is its level of detail. It's very comprehensive, to a much greater extent that we need for our purposes.

We're only interested in what stops serve each line, which we'll have to figure out through the various associations between:

- Stops
- Stop times
- Trips
- Routes (What we call "Lines" in TfGM terminology)

Another downside of the GTFS feed is how it refers to its lines, and stops. There are inconsistencies between the names included in this feed, the names available over the Real-Time Open Data Portal (Real Time feed), how TfGM refers to lines and stops in its publications, and thus the names customers are used to.

For routes, the GTFS feed includes a `route_short_name` and a `route_long_name`. The short name is set as the colour TfGM uses to denote the line on the _Greater Manchester tram network map_. Other than that map, TfGM do not use these colours to refers to lines in any other publication. The long name includes a few locations the line visits (the start, end, and some in between). Neither of these directly map to how TfGM refers to these routes.

As an example, the "Blue" line in the GTFS feed is publiscised by TfGM as the "Eccles via MediaCityUK" (inbound route), and "Ashton-under-Lyne" (outbound route).

For stops, the names are suffixed with "(Manchester Metrolink)". Stripping that off, they are mostly correct, although there are a few formatting discrepancies between the GTFS feed and the Real Time feed. A few examples:

| GTFS Stop name                               | Real Time feed stop name |
| -------------------------------------------- | ------------------------ |
| Newton Heath & Moston (Manchester Metrolink) | Newton Heath and Moston  |
| Deansgate-Castlefield (Manchester Metrolink) | Deansgate - Castlefield  |
| Besses o'th'barn (Manchester Metrolink)      | Besses O’ Th’ Barn       |

Usages of this data may need to maintain a manual mapping between the ambiguous GTFS names and the names we wish to use.

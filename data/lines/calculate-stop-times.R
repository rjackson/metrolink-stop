renv::restore();

library("gtfsrouter")
packageVersion("gtfsrouter")
library("hms") # load before lubridate because some sort of conflict?
library("lubridate")
library("stringr")
library("plyr")
library("dplyr")
library("pbapply")

gtfs <- extract_gtfs(
    filename = "./gtfs/tfgm.zip",
)

#  Docs say 'gtfs <- gtfs_transfer_table', are they outdated?
gtfs$transfers <- gtfs_transfer_table(gtfs,
    d_limit = 200,
    min_transfer_time = 120
)

gtfs <- gtfs_timetable(gtfs,
    day = "Wed",
    route_pattern = "Line$" # compares against route short name
)

# Only care about metrolink
stops <- filter(gtfs$stops, str_detect(stop_id, "^9400ZZMA"))

for (stop_id in stops$stop_id) {
    print(paste0("Processing data for stop ", stop_id))
    x <- gtfs_traveltimes(
        gtfs,
        from = stop_id,
        from_is_id = TRUE,
        start_time_limits = c(12, 14) * 3600,
        max_traveltime = 60 * 60 * 4 # 4 minutes? shouldn't this be 40?
    )

    if (length(x$duration) == 0) {
        next
    }

    x$duration <- period_to_seconds(hms(x$duration))
    write.csv(
        x,
        paste0("./isochrones/time-between-stops/", stop_id, ".csv"),
        row.names = FALSE
    )
}

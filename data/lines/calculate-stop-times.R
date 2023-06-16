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

# transfer table won't build with only metrolink stops
gtfs$transfers <- gtfs_transfer_table(gtfs,
    d_limit = 200,
    min_transfer_time = 120
)

# Only care about metrolink
gtfs$stops <- filter(gtfs$stops, str_detect(stop_id, "^9400ZZMA"))
gtfs$stop_times <- filter(gtfs$stop_times, str_detect(stop_id, "^9400ZZMA"))

# Merge many metrolink platforms into a single stop
canonical_stops <- aggregate(stop_id ~ stop_name,gtfs$stops, function(x) unique(x)[1])
stop_id_to_stop_name <- setNames(gtfs$stops$stop_id, gtfs$stops$stop_name)
stop_name_to_canonical_stop_id <- setNames(stop_id_to_stop_name[gtfs$stops$stop_name], gtfs$stops$stop_id)
gtfs$stops <- gtfs$stops[gtfs$stops$stop_id %in% canonical_stops$stop_id]
gtfs$stop_times$stop_id <- stop_name_to_canonical_stop_id[gtfs$stop_times$stop_id]

gtfs <- gtfs_timetable(gtfs,
   day = "Wed",
   route_pattern = "Line$" # compares against route short name. This matches metrolink routes
)

# Only care about metrolink
stops <- filter(gtfs$stops, str_detect(stop_id, "^9400ZZMA"))

# Remove previously-generated stop files
csv_path <- "./isochrones/time-between-stops"
files <- list.files(csv_path)
csv_files <- files[grepl("\\.csv$", files, ignore.case = TRUE)]
file.remove(file.path(csv_path, csv_files))

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

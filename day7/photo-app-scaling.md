
# SnapShare: Photo App Scaling Plan

## 1. Assumptions

The following assumptions are used to estimate SnapShare's workload:

- Registered users: 10 million.
- Daily active users (DAU): 10% of registered users.
- Each active user uploads one photo per day.
- Each active user views 50 feed pages per day.
- Each original photo averages 2 MB.
- Each thumbnail averages 50 KB.
- A day has 86,400 seconds, and a year has 365 days.
- Peak traffic is estimated at five times average traffic.
- Storage estimates use decimal units: 1 TB = 1,000,000 MB.
- Every uploaded photo is retained for one year, and each photo gets one thumbnail.
- The estimates exclude backups, database storage, replication overhead, and any extra copies made by the CDN.

## 2. Traffic and Storage Estimates

### Daily active users

Daily active users = Registered users × Active percentage

10,000,000 × 0.10 = **1,000,000 daily active users**

### Upload traffic

Daily uploads = 1,000,000 users × 1 photo

Daily uploads = **1,000,000 photos**

Average uploads per second:

1,000,000 ÷ 86,400 = **11.57 uploads/second**

Peak uploads per second:

11.57 × 5 = **57.87 uploads/second**

The system should plan for approximately 58 uploads per second at peak.

### Feed traffic

Daily feed views = 1,000,000 users × 50 pages

Daily feed views = **50,000,000 feed pages**

Average feed views per second:

50,000,000 ÷ 86,400 = **578.70 feed views/second**

Peak feed views per second:

578.70 × 5 = **2,893.52 feed views/second**

The system should plan for approximately 2,894 feed views per second at peak.

These figures estimate feed-page requests, not the number of individual photos or image downloads. One feed page may display several photos and generate multiple image requests.

### Photo storage per year

Original photo storage per day:

1,000,000 × 2 MB = **2,000,000 MB = 2 TB/day**

Thumbnail storage per day:

1,000,000 × 50 KB = 50,000,000 KB = **50 GB/day**

Combined storage per day:

2 TB + 0.05 TB = **2.05 TB/day**

Original photo storage per year:

2 TB × 365 = **730 TB/year**

Thumbnail storage per year:

0.05 TB × 365 = **18.25 TB/year**

Total storage per year:

730 TB + 18.25 TB = **748.25 TB/year**

SnapShare therefore needs approximately 748.25 TB of new object storage per year before accounting for backups, replicas, or other overhead. Storage grows continuously if old photos are not deleted.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a read-heavy system because users view 50 feed pages per day but upload only one photo per day. This produces approximately 50 feed-page views for every upload.

The architecture should prioritize fast feed delivery through caching, database read replicas, efficient feed queries, and a CDN for images. Uploads must also be reliable, but thumbnail processing should happen asynchronously so that users do not wait for every processing step to finish.

## 4. Why Photos Should Not Be Stored Inside the Database

Original photos and thumbnails should be stored in object storage rather than directly inside relational database rows. Large binary files can increase database size, backups, replication costs, and query overhead. Object storage is designed for large files and can scale independently from the database.

The database should store photo metadata, such as the photo ID, owner ID, caption, upload time, and object-storage key or URL. The actual image files should live in object storage, and the CDN can cache frequently requested images close to users.

## 5. Architecture Diagram

```text
                         +------------------+
                         |      Users       |
                         +--------+---------+
                                  |
                                  v
                         +------------------+
                         |       CDN        |
                         | Cached images    |
                         +--------+---------+
                                  |
                      Feed/API requests miss
                                  |
                                  v
                         +------------------+
                         |  Load Balancer   |
                         +--------+---------+
                                  |
                     +------------+------------+
                     |            |            |
                     v            v            v
                 +--------+   +--------+   +--------+
                 | App 1  |   | App 2  |   | App N  |
                 +---+----+   +---+----+   +---+----+
                     |            |            |
                     +------------+------------+
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
             +-------------+            +----------------+
             | Redis Cache |            | Primary DB     |
             | Feed/cache  |            | Users, metadata|
             +-------------+            +-------+--------+
                                                |
                                                | Replication
                                                v
                                        +----------------+
                                        | Read Replica   |
                                        | Feed queries   |
                                        +----------------+

        Photo upload and thumbnail processing:

        App Servers --------------------> Object Storage
              |                           Original photos
              |                                   |
              v                                   |
          +---------+                             |
          |  Queue  |                             |
          +----+----+                             |
               |                                  |
               v                                  |
          +------------+                           |
          |  Worker    |---------------------------+
          | Thumbnail  |     Saves thumbnail
          | generator  |
          +------------+
```

## 6. What Each Component Solves

- **CDN:** Delivers cached images and thumbnails from locations near users, reducing latency and requests reaching the origin.
- **Load balancer:** Distributes incoming API requests across healthy app servers so that one server does not handle all traffic.
- **App servers:** Handle authentication, upload authorization, feed requests, metadata operations, and business logic.
- **Redis cache:** Stores frequently accessed feed data or metadata to reduce repeated database queries; cached data must be invalidated or updated when relevant data changes.
- **Primary database:** Stores authoritative relational data, including users, follows, photo metadata, and other records that must be updated reliably.
- **Read replica:** Handles suitable read-only queries, such as feed metadata lookups, to reduce read pressure on the primary database; replication can introduce some delay.
- **Object storage:** Stores original photos and generated thumbnails durably and scales independently of the database.
- **Queue:** Holds thumbnail-generation jobs so that uploads do not have to wait for image processing to finish.
- **Thumbnail worker:** Consumes queued jobs, generates smaller image versions, and stores them in object storage for efficient feed delivery.

## 7. Photo Upload Flow

1. A user selects a photo and submits an upload request to the app.
2. An app server authenticates the user, validates the request, and authorizes the upload.
3. The server creates an upload record or reserves a photo ID and provides a short-lived, restricted upload URL or equivalent upload instructions.
4. The user's client uploads the original photo directly to object storage, avoiding the need to send the entire file through an app server.
5. The app verifies that the upload succeeded and records or finalizes the photo metadata in the primary database.
6. The app publishes a thumbnail-generation job to the queue. The job includes the photo ID and the object's storage key.
7. A thumbnail worker retrieves the original image from object storage, validates and resizes it, and creates a 50 KB thumbnail target where practical.
8. The worker saves the thumbnail in object storage and updates the photo's processing status in the database.
9. The photo becomes available in feeds according to the app's publication rules; the UI can show a processing placeholder until the thumbnail is ready.
10. When users scroll their feeds, app servers retrieve feed metadata from the cache or a read replica, and the CDN serves the original or thumbnail image when available.

The upload should not be reported as fully processed until the original is safely stored and its metadata is recorded. The thumbnail job should be retryable, and duplicate jobs should not create inconsistent results.

## 8. Trade-Offs

### Trade-off 1: Cache speed versus freshness

Redis reduces database load and improves feed response times, but cached feeds can become stale when users upload photos or follow someone new. The system needs a cache invalidation or update strategy. A shorter cache lifetime improves freshness but can increase database traffic.

### Trade-off 2: Asynchronous thumbnails versus immediate availability

A queue allows uploads to finish without waiting for thumbnail processing, improving responsiveness and absorbing bursts of traffic. However, thumbnails may not be available immediately, and workers can fail or fall behind. The system needs retries, monitoring, and a fallback display while processing is pending.

### Trade-off 3: Read replicas versus consistency

A read replica helps scale feed reads, but replication lag can cause a newly uploaded photo or updated metadata to appear late. The system can tolerate this for many feed views but should use the primary database for operations that require immediate, authoritative results.

### Trade-off 4: Object storage and CDN versus cost and complexity

Object storage and a CDN are suitable for large image workloads and reduce pressure on application servers. However, they introduce storage, bandwidth, cache-invalidation, access-control, and operational costs. Private photos may also require signed URLs or another secure delivery mechanism.

## 9. Conclusion

SnapShare has approximately one million daily active users, 11.57 average uploads per second, 578.70 average feed views per second, and 748.25 TB of new photo and thumbnail storage per year under the stated assumptions.

Because feed reads greatly outnumber uploads, the architecture prioritizes caching, read replicas, object storage, and CDN delivery. A queue and thumbnail workers keep image processing separate from the upload request, helping the application handle traffic bursts and scale individual components independently.
```

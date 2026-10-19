# Day 8 — Course Reflection

## 1. What was the most difficult concept, and how did I overcome it?

The most difficult concept for me was understanding how to prevent race conditions in a system where many users perform actions at the same time. For example, two customers might select the same concert seat and attempt to purchase it simultaneously. I learned that checking availability in the frontend is not enough because both customers could see the seat as available before either transaction finishes. I overcame this by studying database transactions, atomic conditional updates, row locking, and unique constraints. I now understand that the database must be the final authority for critical operations.

## 2. Which part of my capstone would I improve based on feedback?

I would improve the architecture and capacity-planning sections by making the assumptions behind every estimate more explicit and distinguishing average traffic from peak traffic. I would also strengthen the explanation of failure recovery, database failover, and the difference between cached seat availability and authoritative booking data. This would make the design easier for another engineer to implement and review. I would use the actual feedback received during the presentation to prioritize the most important changes.

## 3. What will I learn next?

Next, I want to learn more about PostgreSQL concurrency and transaction isolation, Redis caching strategies, message queues, and load testing. I also want to build a small ticket-booking prototype and simulate concurrent purchase requests to test whether the database prevents double-booking under pressure. This will help me move from writing system design documents to implementing and testing reliable systems.
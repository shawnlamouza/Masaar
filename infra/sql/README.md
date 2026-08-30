# Masaar SQL Server setup

Masaar now uses Microsoft SQL Server for persistent staging and production data. The schema works with SQL Server Developer/Express locally and Amazon RDS for SQL Server on AWS; all tables and operational views can be inspected directly in SQL Server Management Studio (SSMS).

1. Create an empty database named `Masaar` (or choose another database name).
2. In SSMS, select that database and run `001_masaar_schema.sql` followed by `002_operator_views.sql`.
3. Create a least-privilege SQL login, then set `SQLSERVER_CONNECTION_STRING` in `apps/api/.env` or the process environment. A local example is `Server=localhost;Database=Masaar;User Id=masaar_app;Password=replace-me;Encrypt=false;TrustServerCertificate=true`. The current Node driver uses SQL authentication; opening and inspecting the same database in SSMS is independent of how SSMS authenticates.
4. Start Masaar. The API re-checks the same idempotent SQL Server schema at startup.

For Amazon RDS, store the full connection string in AWS Secrets Manager, keep the database private, allow only the API security group to reach TCP 1433, enable encryption and automated backups, and test restore before a pilot. Local development may intentionally leave the variable blank to use deterministic in-memory demo data.

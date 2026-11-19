import sqlite3

conn = sqlite3.connect('prisma/dev.db')
c = conn.cursor()

c.execute("""
UPDATE Participant
SET calendarUrl = REPLACE(calendarUrl, 'https://www.gruposanagustin.cl/wsj2027cuota/', '/calendarios/')
WHERE calendarUrl LIKE '%gruposanagustin.cl/wsj2027cuota/%'
""")

conn.commit()
print(f"Updated {c.rowcount} participant records with local calendar paths.")

# Verify remaining external links
remaining = c.execute("SELECT COUNT(*) FROM Participant WHERE calendarUrl LIKE '%gruposanagustin%'").fetchone()[0]
print(f"Remaining external gruposanagustin links: {remaining}")

# Check sample local links
sample = c.execute("SELECT rut, firstName, lastName, calendarUrl FROM Participant WHERE calendarUrl LIKE '/calendarios/%' LIMIT 5").fetchall()
for s in sample:
    print(s)

conn.close()

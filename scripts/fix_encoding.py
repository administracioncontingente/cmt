import sqlite3

def fix_mojibake(val):
    if not val or not isinstance(val, str):
        return val
    if not any(marker in val for marker in ["Ã", "Â"]):
        return val
    try:
        return val.encode("latin1").decode("utf-8")
    except Exception:
        return val

def fix_database():
    conn = sqlite3.connect("prisma/dev.db")
    c = conn.cursor()

    total_fixed_fields = 0

    # 1. Fix Participant table
    c.execute("PRAGMA table_info(Participant)")
    p_columns = [col[1] for col in c.fetchall() if col[2] == "TEXT"]

    c.execute(f"SELECT id, {', '.join(p_columns)} FROM Participant")
    p_rows = c.fetchall()

    print(f"Examinando {len(p_rows)} participantes...")
    for row in p_rows:
        pid = row[0]
        updates = []
        params = []
        for col_name, val in zip(p_columns, row[1:]):
            if val is not None:
                fixed = fix_mojibake(val)
                if fixed != val:
                    updates.append(f"{col_name} = ?")
                    params.append(fixed)
                    total_fixed_fields += 1
        
        if updates:
            params.append(pid)
            c.execute(f"UPDATE Participant SET {', '.join(updates)} WHERE id = ?", params)

    # 2. Fix Payment table
    c.execute("PRAGMA table_info(Payment)")
    pay_columns = [col[1] for col in c.fetchall() if col[2] == "TEXT"]

    c.execute(f"SELECT id, {', '.join(pay_columns)} FROM Payment")
    pay_rows = c.fetchall()

    print(f"Examinando {len(pay_rows)} pagos/abonos...")
    for row in pay_rows:
        pay_id = row[0]
        updates = []
        params = []
        for col_name, val in zip(pay_columns, row[1:]):
            if val is not None:
                fixed = fix_mojibake(val)
                if fixed != val:
                    updates.append(f"{col_name} = ?")
                    params.append(fixed)
                    total_fixed_fields += 1

        if updates:
            params.append(pay_id)
            c.execute(f"UPDATE Payment SET {', '.join(updates)} WHERE id = ?", params)

    conn.commit()
    conn.close()

    print(f"✅ Se corrigieron exitosamente {total_fixed_fields} campos en la base de datos.")

if __name__ == "__main__":
    fix_database()

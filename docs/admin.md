# Admin & Editor Guide

## Roles

| Flag | Table | What it unlocks |
|---|---|---|
| `is_admin` | `users` | Official Lives, Announcements, Roadmap, Contributors management |
| `is_editor` | `users` | Write/edit song and artist introductions on the site |

> The `-h localhost` flag is required for all `psql` commands below — it forces TCP (password auth). Without it, psql uses peer auth and will reject the `vocarank` user.

## Granting Admin Access

```bash
# Find the user account
psql -U vocarank -d vocarank -h localhost -c \
  "SELECT id, email, name FROM users ORDER BY created_at LIMIT 10;"

# Grant admin
psql -U vocarank -d vocarank -h localhost -c \
  "UPDATE users SET is_admin = true WHERE email = 'your@email.com';"
```

Sign out and back in after granting — `isAdmin` is baked into the NextAuth JWT at login time and won't update in an active session.

### What admins can do

- Create, edit, and delete **Official Lives** (curated concert/event playlist collections)
- Assign or unassign public playlists to an Official Live
- Manage **Announcements** on the About page
- Manage **Roadmap** items on the About page
- Manage the **Contributors** list on the About page

## Granting Editor Access

```bash
psql -U vocarank -d vocarank -h localhost -c \
  "UPDATE users SET is_editor = true WHERE email = 'editor@example.com';"
```

Editors can write and update song/artist introductions directly from the song or artist detail page.

## Official Lives: Playlist Assignment

From the Official Live detail page, admins can link any public playlist to a live. To unassign, set `live_id = 0` via the PATCH `/playlists/{id}` endpoint (the API interprets `0` as "unassign" and sets `live_id` to NULL in the database).

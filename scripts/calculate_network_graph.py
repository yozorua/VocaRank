import json
import sqlite3
import datetime
import networkx as nx
import os
import sys

# Add parent dir to path so we can import from core if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import scripts.core as core

def calculate_network_graph():
    core.log_message("INFO", "Starting Network Graph (PageRank) calculation...")
    
    conn = core.get_db_connection()
    core.setup_database_schema(conn) # Ensure system_cache exists
    
    cursor = conn.cursor()
    
    synth_types_sql = "('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'NEUTRINO', 'AIVOICE', 'VOICEVOX', 'NewType', 'Voiceroid', 'ACEVirtualSinger')"

    # 1. Fetch all Producer artists and their total views (ONLY counting vocal synth songs)
    cursor.execute(f"""
        SELECT a.id, a.name_default, a.artist_type, a.picture_url_thumb, a.picture_url_original,
               COALESCE(SUM(s.youtube_views + s.niconico_views), 0) as total_views
        FROM artists a
        LEFT JOIN song_artists sa ON a.id = sa.artist_id
        LEFT JOIN songs s ON sa.song_id = s.id
        WHERE a.artist_type IN ('Producer', 'Circle', 'Other Group')
          AND EXISTS (
              SELECT 1 FROM song_artists sa_voc 
              JOIN artists a_voc ON sa_voc.artist_id = a_voc.id 
              WHERE sa_voc.song_id = s.id 
                AND a_voc.artist_type IN {synth_types_sql}
          )
        GROUP BY a.id
        ORDER BY total_views DESC
    """)
    artists_rows = cursor.fetchall()
    
    # 2. Trim immediately to Top 1000 most viewed Producers to guarantee famous ones are included
    TOP_N = 1000
    core.log_message("INFO", f"Filtering to Top {TOP_N} most viewed Producers...")
    top_artists_rows = artists_rows[:TOP_N]
    
    nodes = []
    artist_map = {}
    
    for row in top_artists_rows:
        aid = str(row[0])
        views = int(row[5])
        nodes.append({
            "id": aid,
            "name": row[1],
            "group": row[2] or "Unknown",
            "img": row[3] or row[4] or "",
            "views": views,
            "val_views": views # Pass raw views directly to frontend for math.cbrt rendering
        })
        artist_map[aid] = True
        
    # 3. Fetch collaborations to create links (edges) ONLY between these Top 500 and ONLY via Vocaloid songs
    core.log_message("INFO", "Fetching collaborations between top producers...")
    cursor.execute(f"""
        SELECT sa1.artist_id as source, sa2.artist_id as target, COUNT(sa1.song_id) as weight
        FROM song_artists sa1
        JOIN song_artists sa2 ON sa1.song_id = sa2.song_id AND sa1.artist_id < sa2.artist_id
        JOIN songs s ON sa1.song_id = s.id
        WHERE s.song_type IN ('Original', 'Remaster', 'Remix', 'Cover')
          AND EXISTS (
              SELECT 1 FROM song_artists sa_voc 
              JOIN artists a_voc ON sa_voc.artist_id = a_voc.id 
              WHERE sa_voc.song_id = sa1.song_id 
                AND a_voc.artist_type IN {synth_types_sql}
        )
        GROUP BY sa1.artist_id, sa2.artist_id
    """)
    links_rows = cursor.fetchall()
    
    links = []
    for row in links_rows:
        source = str(row[0])
        target = str(row[1])
        weight = row[2]
        if source in artist_map and target in artist_map:
            links.append({
                "source": source,
                "target": target,
                "value": weight
            })
            
    # 4. Calculate NetworkX PageRank for alternative "Connections" sizing
    core.log_message("INFO", f"Building NetworkX Graph with {len(nodes)} nodes and {len(links)} links...")
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for l in links:
        G.add_edge(l["source"], l["target"], weight=l["value"])
        
    try:
        core.log_message("INFO", "Calculating Eigenvector Centrality (PageRank)...")
        pr = nx.pagerank(G, weight='weight')
        max_pr = max(1e-9, max(pr.values())) if pr else 1
        for n in nodes:
            # Scale PR relative to max PR in the subgraph (1 to 100 scale)
            n["val_pagerank"] = max(1, (pr.get(n["id"], 0) / max_pr) * 100)
    except Exception as e:
        core.log_message("ERROR", f"PageRank calculation failed: {e}")
        for n in nodes:
            n["val_pagerank"] = 1
            
    # Default 'val' used by ForceGraph to the views scale
    for n in nodes:
        n["val"] = n["val_views"]
    
    # 5. Save graph to system_cache
    graph_dict = {"nodes": nodes, "links": links}
    json_data = json.dumps(graph_dict)
    
    core.log_message("INFO", "Saving pre-calculated graph to database 'system_cache'...")
    last_updated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    cursor.execute('''
        INSERT OR REPLACE INTO system_cache (key_name, json_data, last_updated)
        VALUES (?, ?, ?)
    ''', ("network_graph", json_data, last_updated))
    
    conn.commit()
    conn.close()
    
    core.log_message("SUCCESS", "Network Graph successfully generated and cached!")
    return links_rows

def calculate_vocalist_network_graph(producer_links_rows):
    core.log_message("INFO", "Starting Vocalist Network Graph (PageRank) calculation...")
    
    conn = core.get_db_connection()
    core.setup_database_schema(conn)
    cursor = conn.cursor()
    
    synth_types_sql = "('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'NEUTRINO', 'AIVOICE', 'VOICEVOX', 'NewType', 'Voiceroid', 'ACEVirtualSinger')"

    # 1. Fetch all Vocal Synth artists and their total views
    cursor.execute(f"""
        SELECT a.id, a.name_default, a.artist_type, a.picture_url_thumb, a.picture_url_original,
               COALESCE(SUM(s.youtube_views + s.niconico_views), 0) as total_views
        FROM artists a
        LEFT JOIN song_artists sa ON a.id = sa.artist_id
        LEFT JOIN songs s ON sa.song_id = s.id
        WHERE a.artist_type IN {synth_types_sql}
        GROUP BY a.id
        ORDER BY total_views DESC
    """)
    artists_rows = cursor.fetchall()
    
    # Trim to Top 1000 most viewed vocalists
    TOP_N = 1000
    core.log_message("INFO", f"Filtering to Top {TOP_N} most viewed Vocalists...")
    top_artists_rows = artists_rows[:TOP_N]
    
    nodes = []
    artist_map = {}
    
    for row in top_artists_rows:
        aid = str(row[0])
        views = int(row[5])
        nodes.append({
            "id": aid,
            "name": row[1],
            "group": row[2] or "Unknown",
            "img": row[3] or row[4] or "",
            "views": views,
            "val_views": views
        })
        artist_map[aid] = True
        
    # 3. Fetch collaborations to create links ONLY between Vocalists on the exact same song
    # CRITICAL FIX: To prevent an O(N^2) Cartesian join across all 150,000 artists, strictly limit this cross-join
    # We accomplish this by passing the `producer_links_rows` since that query ALREADY generated the Cartesian 
    # pairs for ALL artists working on vocal synth songs! We just filter it natively in python instantly.
    core.log_message("INFO", "Fetching collaborations between vocalists...")
    links_rows = producer_links_rows
    
    links = []
    for row in links_rows:
        source = str(row[0])
        target = str(row[1])
        weight = row[2]
        if source in artist_map and target in artist_map:
            links.append({
                "source": source,
                "target": target,
                "value": weight
            })
            
    # CRITICAL FIX: The Vocalist Graph is highly dense. 1000 vocalists group-singing implies a near-complete
    # mathematical graph (120,000+ links). Because we upgraded the frontend to vanilla `force-graph` and 
    # patched the explicit browser DOM dimensions, we can safely scale up our rendering density to 10,000 links!
    links.sort(key=lambda x: x["value"], reverse=True)
    # links = links[:10000]
            
    # 4. Calculate NetworkX PageRank
    core.log_message("INFO", f"Building NetworkX Graph with {len(nodes)} nodes and {len(links)} links...")
    G = nx.Graph()
    for n in nodes:
        G.add_node(n["id"])
    for l in links:
        G.add_edge(l["source"], l["target"], weight=l["value"])
        
    try:
        core.log_message("INFO", "Calculating Eigenvector Centrality (PageRank)...")
        pr = nx.pagerank(G, weight='weight')
        max_pr = max(1e-9, max(pr.values())) if pr else 1
        for n in nodes:
            n["val_pagerank"] = max(1, (pr.get(n["id"], 0) / max_pr) * 100)
    except Exception as e:
        core.log_message("ERROR", f"PageRank calculation failed: {e}")
        for n in nodes:
            n["val_pagerank"] = 1
            
    for n in nodes:
        n["val"] = n["val_views"]
    
    graph_dict = {"nodes": nodes, "links": links}
    json_data = json.dumps(graph_dict)
    
    last_updated = datetime.datetime.now(datetime.timezone.utc).isoformat()
    cursor.execute('''
        INSERT OR REPLACE INTO system_cache (key_name, json_data, last_updated)
        VALUES (?, ?, ?)
    ''', ("vocalist_network_graph", json_data, last_updated))
    
    conn.commit()
    conn.close()
    
    core.log_message("SUCCESS", "Vocalist Network Graph successfully generated and cached!")

if __name__ == "__main__":
    links_rows = calculate_network_graph()
    calculate_vocalist_network_graph(links_rows)

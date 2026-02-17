from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Optional
import json


SYNTH_TYPES = (
    'Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'NEUTRINO', 
    'AIVOICE', 'VOICEVOX', 'NewType', 'Voiceroid', 'ACEVirtualSinger'
)

def extract_pvs(pv_data_json: str):
    """Parses PV data and returns (youtube_id, niconico_id)."""
    yt_id, nico_id = None, None
    try:
        if not pv_data_json:
            return None, None
        pvs = json.loads(pv_data_json)
        if isinstance(pvs, list):
            for pv in pvs:
                service = pv.get('service')
                if service == 'Youtube' and not yt_id:
                    yt_id = pv.get('pvId')
                elif service == 'NicoNicoDouga' and not nico_id:
                    nico_id = pv.get('pvId')
    except:
        pass
    return yt_id, nico_id

def get_artists_for_songs(db: Session, song_ids: List[int]) -> Dict[int, Dict[str, List[str]]]:
    """
    Fetches artist names grouped by role (Producer vs Vocalist) for songs.
    Returns: {song_id: {'producers': [], 'vocalists': []}}
    """
    if not song_ids:
        return {}
        
    ids_str = ",".join(str(sid) for sid in song_ids)
    
    # We fetch name_default and artist_type
    sql = text(f"""
        SELECT sa.song_id, a.name_default, a.artist_type 
        FROM song_artists sa 
        JOIN artists a ON sa.artist_id = a.id 
        WHERE sa.song_id IN ({ids_str})
    """)
    
    results = db.execute(sql).fetchall()
    
    artist_map = {}
    for sid, name, atype in results:
        if sid not in artist_map:
            artist_map[sid] = {'producers': [], 'vocalists': []}
            
        if atype == 'Producer':
            artist_map[sid]['producers'].append(name)
        elif atype in SYNTH_TYPES:
            artist_map[sid]['vocalists'].append(name)
            
    return artist_map

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

def get_artists_for_songs(db: Session, song_ids: List[int]) -> Dict[int, Dict[str, List[Dict]]]:
    """
    Fetches artist details grouped by role (Producer vs Vocalist) for songs.
    Returns: {song_id: {'producers': [ArtistTiny], 'vocalists': [ArtistTiny]}}
    """
    if not song_ids:
        return {}
        
    from sqlalchemy import bindparam
    
    # We fetch id, name, artist_type, and picture_url_thumb
    sql = text("""
        SELECT sa.song_id, a.id, a.name_default, a.artist_type, a.picture_url_thumb
        FROM song_artists sa 
        JOIN artists a ON sa.artist_id = a.id 
        WHERE sa.song_id IN :song_ids
    """).bindparams(bindparam('song_ids', expanding=True))
    
    results = db.execute(sql, {'song_ids': song_ids}).fetchall()
    
    artist_map = {}
    
    # helper to check known vocaltypes
    def is_vocalist(atype):
        return atype in SYNTH_TYPES
        
    for sid, aid, name, atype, thumb in results:
        if sid not in artist_map:
            artist_map[sid] = {'producers': [], 'vocalists': [], 'others': []}
            
        artist_obj = {'id': aid, 'name': name, 'artist_type': atype, 'picture_url_thumb': thumb}
        
        if atype in ('Producer', 'Circle', 'OtherGroup'):
            artist_map[sid]['producers'].append(artist_obj)
        elif is_vocalist(atype):
            artist_map[sid]['vocalists'].append(artist_obj)
        else:
            artist_map[sid]['others'].append(artist_obj)
            
    # Post-process: If no producers, try to use 'others' (e.g. Animator, Illustrator, etc.)
    # This prevents "Unknown" when we have some artist info but strict type matching failed
    final_map = {}
    for sid, data in artist_map.items():
        producers = data['producers']
        vocalists = data['vocalists']
        
        if not producers and data['others']:
             # Use others as fallback for producers
             producers = data['others']
             
        final_map[sid] = {'producers': producers, 'vocalists': vocalists}
             
    return final_map

use std::collections::{HashMap, HashSet};
use std::hash::Hash;
use rand::seq::SliceRandom;

/// Source-independent metadata used only after a provider has found real tracks.
pub struct Candidate<Id> {
    pub id: Id,
    pub artist: String,
    pub year: Option<i32>,
    pub style: String,
    pub familiar_artist: bool,
    pub seed_artist: bool,
}

pub fn major_style(style: &str) -> String {
    let value = style.trim().to_lowercase();
    let groups: &[(&str, &[&str])] = &[
        ("rnb", &["r&b", "rnb", "rhythm and blues", "soul", "neo soul", "funk"]),
        ("hiphop", &["hip hop", "hip-hop", "rap", "trap", "drill"]),
        ("rock", &["rock", "punk", "grunge", "indie rock", "alternative rock"]),
        ("pop", &["pop", "synthpop", "dance pop", "k-pop", "j-pop"]),
        ("electronic", &["electronic", "edm", "house", "techno", "ambient", "trance", "dubstep"]),
        ("jazz", &["jazz", "bebop", "swing", "bossa nova"]),
        ("classical", &["classical", "orchestral", "chamber music", "opera"]),
        ("country", &["country", "bluegrass", "americana"]),
        ("folk", &["folk", "acoustic folk"]),
        ("metal", &["metal", "hardcore"]),
        ("reggae", &["reggae", "ska", "dancehall"]),
        ("latin", &["latin", "salsa", "bachata", "reggaeton"]),
        ("blues", &["blues"]),
    ];
    for (group, terms) in groups {
        if terms.iter().any(|term| value.contains(term)) { return (*group).into(); }
    }
    value
}

pub fn same_major_style(reference: &str, candidate: &str) -> bool {
    !reference.trim().is_empty() && !candidate.trim().is_empty()
        && major_style(reference) == major_style(candidate)
}

struct Selection<Id> {
    ids: Vec<Id>,
    seen: HashSet<Id>,
    artist_counts: HashMap<String, usize>,
    style_counts: HashMap<String, usize>,
    new_artists: HashSet<String>,
    limit: usize,
}

impl<Id: Clone + Eq + Hash> Selection<Id> {
    fn new(limit: usize) -> Self {
        Self { ids: Vec::new(), seen: HashSet::new(), artist_counts: HashMap::new(), style_counts: HashMap::new(), new_artists: HashSet::new(), limit }
    }

    fn can_add(&self, candidate: &Candidate<Id>) -> bool {
        self.ids.len() < self.limit && !self.seen.contains(&candidate.id)
            && self.artist_counts.get(&candidate.artist.to_lowercase()).copied().unwrap_or(0) < 2
    }

    fn add(&mut self, candidate: &Candidate<Id>) {
        if !self.can_add(candidate) { return; }
        self.seen.insert(candidate.id.clone());
        *self.artist_counts.entry(candidate.artist.to_lowercase()).or_default() += 1;
        *self.style_counts.entry(candidate.style.to_lowercase()).or_default() += 1;
        if !candidate.familiar_artist { self.new_artists.insert(candidate.artist.to_lowercase()); }
        self.ids.push(candidate.id.clone());
    }
}

/// Reserve room for new artists, recent and older releases, then spread across
/// decades and subgenres. Randomize ties so repeated runs explore the pool.
pub fn select_balanced<Id: Clone + Eq + Hash>(
    candidates: &[Candidate<Id>], limit: usize, primary_style: &str, current_year: i32,
) -> Vec<Id> {
    let mut eligible: Vec<_> = candidates.iter()
        .filter(|candidate| same_major_style(primary_style, &candidate.style))
        .collect();
    if eligible.is_empty() {
        eligible = candidates.iter().collect();
    }
    eligible.shuffle(&mut rand::thread_rng());
    let mut selected = Selection::new(limit);

    // These are preferences, not reasons to insert a track with the wrong style.
    if let Some(candidate) = eligible.iter().find(|candidate| candidate.year == Some(current_year)) { selected.add(candidate); }
    if let Some(candidate) = eligible.iter().find(|candidate| candidate.year.is_some_and(|year| year <= current_year - 10)) { selected.add(candidate); }
    if let Some(candidate) = eligible.iter().find(|candidate| candidate.seed_artist) { selected.add(candidate); }

    for candidate in eligible.iter().filter(|candidate| !candidate.familiar_artist) {
        if selected.new_artists.len() >= 4 { break; }
        selected.add(candidate);
    }

    for decade in (1960..=(current_year / 10 * 10)).step_by(10) {
        if let Some(candidate) = eligible.iter().find(|candidate| candidate.year.is_some_and(|year| year / 10 * 10 == decade)) {
            selected.add(candidate);
        }
    }

    while selected.ids.len() < limit {
        let next = eligible.iter()
            .filter(|candidate| selected.can_add(candidate))
            .min_by_key(|candidate| selected.style_counts.get(&candidate.style.to_lowercase()).copied().unwrap_or(0));
        let Some(candidate) = next else { break; };
        selected.add(candidate);
    }
    if selected.ids.len() < limit {
        let mut remaining: Vec<_> = candidates.iter().collect();
        remaining.shuffle(&mut rand::thread_rng());
        for candidate in remaining {
            selected.add(candidate);
        }
    }
    selected.ids
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_style_and_includes_new_and_old_artists() {
        let candidates = vec![
            Candidate { id: 1, artist: "seed".into(), year: Some(2026), style: "R&B".into(), familiar_artist: true, seed_artist: true },
            Candidate { id: 2, artist: "seed".into(), year: Some(2020), style: "R&B".into(), familiar_artist: true, seed_artist: true },
            Candidate { id: 3, artist: "new".into(), year: Some(1990), style: "Neo Soul".into(), familiar_artist: false, seed_artist: false },
            Candidate { id: 4, artist: "wrong".into(), year: Some(1980), style: "Rock".into(), familiar_artist: false, seed_artist: false },
            Candidate { id: 5, artist: "new2".into(), year: Some(2010), style: "Contemporary R&B".into(), familiar_artist: false, seed_artist: false },
        ];
        let result = select_balanced(&candidates, 5, "R&B", 2026);
        assert!(result.contains(&1) && result.contains(&3) && result.contains(&5));
        assert!(result.contains(&4));
        assert_eq!(result.len(), 5);
    }

    #[test]
    fn falls_back_to_available_candidates_when_style_tags_do_not_match() {
        let candidates = vec![Candidate { id: 1, artist: "artist".into(), year: None,
            style: "adjacent style".into(), familiar_artist: false, seed_artist: false }];
        assert_eq!(select_balanced(&candidates, 5, "unknown style", 2026), vec![1]);
    }
}

use rand::seq::SliceRandom;
use rand::thread_rng;

pub fn random_num(len: usize, take: usize) -> Vec<usize> {
    let mut rng = thread_rng();

    let mut range: Vec<usize> = (0..len).collect();

    range.as_mut_slice().shuffle(&mut rng);
    range.into_iter().take(take).collect()
}

use std::io::{Read, Write};
use zstd::{Decoder, Encoder};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn decode(data: &[u8]) -> Vec<u8> {
    let mut pcm = Vec::new();
    let mut decoder = Decoder::new(data).expect("Failed to read data.");
    decoder.read_to_end(&mut pcm).expect("Failed to decompress data.");
    pcm
}

#[wasm_bindgen]
pub fn encode(pcm_data: &[u8]) -> Vec<u8> {
    let mut compressed_data = Vec::new();
    let mut encoder = Encoder::new(&mut compressed_data, 0).expect("Failed to read pcm encoder");

    // Compress the data
    encoder.write_all(pcm_data).expect("Failed to compress data");
    encoder.finish().unwrap();

    compressed_data
}
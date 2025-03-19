<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use getID3;

class AudioController extends Controller
{
    /**
     * Stream audio file from the music directory
     */
    public function stream(Request $request)
    {
        // Get file path from request or use default
        $filePath = $request->input('file', null);
        
        // If no specific file is requested, get a PCM file from the music directory
        if (!$filePath) {
            $musicPath = base_path('music'); // Use project root music folder
            $files = glob($musicPath . '/*.pcm');
        
            if (empty($files)) {
                return response()->json(['error' => 'No PCM files found'], 404);
            }
        
            // Select the first PCM file
            $filePath = $files[0];
        } else {
            // Make sure the file path is within the music directory
            $filePath = base_path('music/' . $filePath);
        
            if (!file_exists($filePath)) {
                return response()->json(['error' => 'File not found'], 404);
            }
        }
        
        // Get file size
        $fileSize = filesize($filePath);
        
        // Stream the raw PCM file directly
        return response()->file($filePath, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => $fileSize,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-cache',
            'Access-Control-Allow-Origin' => '*', // For CORS
        ]);
    }
    
    /**
     * Get metadata for the current audio file
     */
    public function metadata(Request $request)
    {
        // Get file path from request or use default
        $filePath = $request->input('file', null);
        
        // If no specific file is requested, get a random file from the music directory
        if (!$filePath) {
            $musicPath = storage_path('app/music');
            $files = $this->getAudioFiles($musicPath);
            
            if (empty($files)) {
                return response()->json(['error' => 'No audio files found'], 404);
            }
            
            // Select a random file
            $filePath = $files[array_rand($files)];
        } else {
            // Make sure the file path is within the music directory
            $filePath = storage_path('app/music/' . $filePath);
            
            if (!file_exists($filePath)) {
                return response()->json(['error' => 'File not found'], 404);
            }
        }
        
        // Extract metadata using getID3 library (you'll need to install this)
        // composer require james-heinrich/getid3
        $metadata = $this->extractMetadata($filePath);
        
        return response()->json($metadata);
    }
    
    /**
     * Get all audio files from a directory recursively
     */
    private function getAudioFiles($directory)
    {
        $audioFiles = [];
        $files = File::allFiles($directory);
        
        foreach ($files as $file) {
            $extension = strtolower($file->getExtension());
            if (in_array($extension, ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'])) {
                $audioFiles[] = $file->getPathname();
            }
        }
        
        return $audioFiles;
    }
    
    /**
     * Get content type based on file extension
     */
    private function getContentType($extension)
    {
        $contentTypes = [
            'mp3' => 'audio/mpeg',
            'wav' => 'audio/wav',
            'ogg' => 'audio/ogg',
            'flac' => 'audio/flac',
            'aac' => 'audio/aac',
            'm4a' => 'audio/mp4',
        ];
        
        return $contentTypes[$extension] ?? 'application/octet-stream';
    }
    
    /**
     * Extract metadata from audio file
     */
    private function extractMetadata($filePath)
    {
        // Initialize getID3 engine
        $getID3 = new getID3();
        
        // Analyze file
        $fileInfo = $getID3->analyze($filePath);
        
        // Extract basic metadata
        $metadata = [
            'title' => $fileInfo['tags']['id3v2']['title'][0] ?? $fileInfo['tags']['id3v1']['title'][0] ?? basename($filePath),
            'artist' => $fileInfo['tags']['id3v2']['artist'][0] ?? $fileInfo['tags']['id3v1']['artist'][0] ?? 'Unknown Artist',
            'album' => $fileInfo['tags']['id3v2']['album'][0] ?? $fileInfo['tags']['id3v1']['album'][0] ?? 'Unknown Album',
            'duration' => $fileInfo['playtime_seconds'] ?? 0,
            'bitrate' => $fileInfo['audio']['bitrate'] ?? 0,
            'sampleRate' => $fileInfo['audio']['sample_rate'] ?? 44100,
            'channels' => $fileInfo['audio']['channels'] ?? 2,
            'format' => $fileInfo['fileformat'] ?? 'unknown',
        ];
        
        // Extract cover art if available
        if (isset($fileInfo['id3v2']['APIC'][0]['data'])) {
            $imageData = $fileInfo['id3v2']['APIC'][0]['data'];
            $base64Image = base64_encode($imageData);
            $mimeType = $fileInfo['id3v2']['APIC'][0]['mime'] ?? 'image/jpeg';
            $metadata['image'] = "data:{$mimeType};base64,{$base64Image}";
        }
        
        return $metadata;
    }
}


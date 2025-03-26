<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;

class AudioController extends Controller
{
    protected $musicPath;

    public function __construct()
    {
        // Set the path to the music folder
        $this->musicPath = base_path('music');
    }

    // Get a specific music file
    public function getFile($filename = null)
    {
        if ($filename) {
            $path = $this->musicPath . '/' . $filename;
            
            if (File::exists($path)) {
                return Response::file($path, [
                    'Content-Type' => 'audio/wav'
                ]);
            }
            
            return response()->json(['error' => 'File not found'], 404);
        }
        
        // If no filename is provided, return the first file
        $files = $this->getFilesList();
        if (count($files) > 0) {
            $path = $this->musicPath . '/' . $files[0];
            
            return Response::file($path, [
                'Content-Type' => 'audio/wav'
            ]);
        }
        
        return response()->json(['error' => 'No music files found'], 404);
    }
    
    // Get metadata for a specific file
    public function getMetadata($filename = null)
    {
        if ($filename) {
            $path = $this->musicPath . '/' . $filename;
            
            if (File::exists($path)) {
                // In a real app, you might extract metadata from the WAV file
                // For now, we'll just return the filename as the title
                return response()->json([
                    'title' => pathinfo($filename, PATHINFO_FILENAME),
                    'artist' => 'Unknown Artist',
                    'image' => asset('images/default-album.jpg')
                ]);
            }
            
            return response()->json(['error' => 'File not found'], 404);
        }
        
        // Default metadata
        return response()->json([
            'title' => 'Music Library',
            'artist' => 'Various Artists',
            'image' => asset('images/default-album.jpg')
        ]);
    }
    
    // List all music files
    public function listFiles()
    {
        $files = $this->getFilesList();
        
        return response()->json([
            'files' => $files
        ]);
    }
    
    // Helper method to get all WAV files
    protected function getFilesList()
    {
        if (!File::exists($this->musicPath)) {
            File::makeDirectory($this->musicPath, 0755, true);
        }
        
        $files = File::files($this->musicPath);
        $fileNames = [];
        
        foreach ($files as $file) {
            $extension = strtolower($file->getExtension());
            if ($extension === 'wav') {
                $fileNames[] = $file->getFilename();
            }
        }
        
        return $fileNames;
    }
}
<?php

use Illuminate\Support\Facades\Route;
use App\Models\User;
use App\Http\Controllers\AudioController;

Route::middleware('api')->group(function () {
    Route::get('/users', function () {
        $users = User::all();
        if (count($users) == 0) {
            return response()->json([
                'status'=> 'error',
                'message' => 'No users found',
            ]);
        } else {
            return response()->json([
                'status'=> 'success',
                'users' => $users,
            ]);
        };
    });

    Route::post('/users', function () {
        User::create([
            'name' => request('name'),
            'password' => bcrypt(request('password')),
        ]);
    });

    Route::put('/users', function () {
        $user = User::find(request('id'));
        if (request('field') == 'password') {
            $user->password = bcrypt(request('password'));
        }
        else{
            $user->name = request('name');
        }
        $user->save();
    });

    Route::delete('/users', function () {
        User::find(request('id'))->delete(); 
    });

    // Route::get('/audio', function (Request $request) {
    //     // Path to music folder in project root
    //     $musicPath = base_path('music');
        
    //     // Debug info
    //     \Log::info('Music path: ' . $musicPath);
    //     \Log::info('Music folder exists: ' . (File::exists($musicPath) ? 'Yes' : 'No'));
        
    //     // Create music directory if it doesn't exist
    //     if (!File::exists($musicPath)) {
    //         File::makeDirectory($musicPath, 0755, true);
    //         \Log::info('Created music directory');
    //         return response()->json(['error' => 'No music folder found'], 404);
    //     }
        
    //     // List all PCM files
    //     $files = File::glob($musicPath . '/*.pcm');
    //     \Log::info('Found PCM files: ' . count($files));
        
    //     if (empty($files)) {
    //         return response()->json(['error' => 'No PCM files found in music folder'], 404);
    //     }
        
    //     // Use the first PCM file
    //     $filePath = $files[0];
    //     \Log::info('Using file: ' . $filePath);
        
    //     // Get file contents
    //     $contents = File::get($filePath);
    //     $fileSize = File::size($filePath);
    //     \Log::info('File size: ' . $fileSize . ' bytes');
        
    //     // Set appropriate headers for PCM audio
    //     return response($contents)
    //         ->header('Content-Type', 'audio/l16') // Use audio/l16 for PCM
    //         ->header('Content-Length', $fileSize)
    //         ->header('Accept-Ranges', 'bytes')
    //         ->header('Cache-Control', 'no-cache')
    //         ->header('Access-Control-Allow-Origin', '*'); // Add CORS header
    // });

    // // Simple metadata endpoint
    // Route::get('/audio/data', function () {
    //     return response()->json([
    //         'image' => '',
    //         'title' => "PCM Audio Test",
    //         'artist' => "Music Folder",
    //     ]);
    // });
    Route::get('/audio', [AudioController::class, 'stream']);
    Route::get('/audio/data', [AudioController::class, 'metadata']);

});
?>
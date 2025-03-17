<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Models\User;

    
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

Route::get('/audio', function () {
    $contents = file_get_contents(public_path('sample.pcm'));
    return response($contents, 200);
});

Route::get('/audio/data', function () {
    return response()->json([
        'image' => '',
        'title' => "Deli (Nick`s version)",
        'artist' => "Ice Spice, Nicki Minaj",
    ]);
});
});
?>
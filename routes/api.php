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

    // Music routes
    Route::prefix('audio')->group(function () {
        Route::get('/', 'App\Http\Controllers\AudioController@getFile');
        Route::get('/list', 'App\Http\Controllers\AudioController@listFiles');
        Route::get('/metadata', 'App\Http\Controllers\AudioController@getMetadata');
        Route::get('/metadata/{filename}', 'App\Http\Controllers\AudioController@getMetadata');
        Route::get('/{filename}', 'App\Http\Controllers\AudioController@getFile');
    });


});
?>
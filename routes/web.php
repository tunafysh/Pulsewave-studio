<?php

use Illuminate\Support\Facades\Route;
use App\Models\User;


    Route::get('/', function () {
        return redirect('http://localhost:3000');
    });

Route::get('/api/users', function () {
    $users = User::all();
    if (count($users) == 0) {
        return response()->json([
            'status'=> 'error',
            'message' => 'No users found',
        ]);
    } ;
});

Route::post('/api/users', function () {
    User::create([
        'name' => request('name'),
        'password' => bcrypt(request('password')),
    ]);
});

Route::put('/api/users/{id}&{field}', function ($id, $field) {
    $user = User::find($id);
    if ($field == 'password') {
        $user->password = bcrypt(request('password'));
    }
    else{
        $user->name = request('name');
    }
    $user->save();
});

Route::delete('/api/users/{id}', function ($id) {
    User::find($id)->delete(); 
});

?>


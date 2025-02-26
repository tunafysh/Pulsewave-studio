<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Request;

if (app()->environment('local')) {

    Route::get('/', function () {
        return redirect('http://localhost:3000');
    });
}
?>


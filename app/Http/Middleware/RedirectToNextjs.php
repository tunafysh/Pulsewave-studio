<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RedirectToNextjs
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {

        if ($request->server('SERVER_PORT') == 8000) {
            $url = $request->fullUrl();
            $newUrl = str_replace('localhost:8000', 'localhost:3000', $url);
            return redirect($newUrl);
        }

        return $next($request);
    }
}

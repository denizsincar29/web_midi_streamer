<?php
/**
 * TURN Server Configuration
 * 
 * Copy this file to config.php and update with your actual values.
 * The config.php file is gitignored so your secrets stay private.
 */

return [
    // Your TURN server domain
    'turnServer' => 'voice.denizsincar.ru',
    
    // Your static-auth-secret from /etc/turnserver.conf
    // Generate with: openssl rand -base64 32
    'turnSecret' => 'YOUR_STATIC_AUTH_SECRET_HERE',
    
    // Credential TTL (time to live) in seconds
    'ttl' => 3600,  // 1 hour
    
    // Allowed origins for CORS (production)
    // Set to your actual domain, or keep '*' for development
    'allowedOrigins' => ['*'],  // Example: ['https://yourdomain.com', 'https://www.yourdomain.com']
];

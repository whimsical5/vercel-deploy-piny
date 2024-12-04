import React from 'react';

const Login = () => {
    const handlePinterestLogin = () => {
        window.location.href = 'http://localhost:5001/auth/pinterest';
    };

    return (
        <div>
            <h1>Login with Pinterest</h1>
            <button onClick={handlePinterestLogin}>Login</button>
        </div>
    );
};
export default Login;
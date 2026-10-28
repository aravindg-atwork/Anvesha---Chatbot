import hashlib
import hmac
import os
import secrets
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from backend.db import connect

router = APIRouter(prefix='/api/auth')
COOKIE = 'anvesha_session'
attempts = {}


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    return f'{salt}:{digest}'


def current_user(request: Request):
    token = request.cookies.get(COOKIE, '')
    digest = hashlib.sha256(token.encode()).hexdigest()
    with connect() as db:
        user = db.execute('SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON s.user_id=u.id '
                          'WHERE s.token_hash=? AND s.expires>?', (digest, int(time.time()))).fetchone()
    if not user:
        raise HTTPException(401, 'Please sign in to continue.')
    return dict(user)


def session_for(user):
    return {'kind': 'local', 'email': user['email'], 'displayName': user['name']}


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=256)
    name: str = Field(default='', max_length=100)


def throttle(request):
    now = time.monotonic()
    for key in list(attempts):
        if now - attempts[key][0] >= 300:
            del attempts[key]
    key = request.client.host if request.client else 'unknown'
    start, count = attempts.get(key, (now, 0))
    attempts[key] = (start, count + 1)
    if count >= 30:
        raise HTTPException(429, 'Too many sign-in attempts. Please wait five minutes.')


def set_session(db, user_id, response):
    token = secrets.token_urlsafe(32)
    db.execute('DELETE FROM sessions WHERE expires<=?', (int(time.time()),))
    db.execute('INSERT INTO sessions VALUES (?,?,?)',
               (hashlib.sha256(token.encode()).hexdigest(), user_id, int(time.time()) + 7 * 86400))
    response.set_cookie(COOKIE, token, httponly=True, samesite='strict', max_age=7 * 86400,
                        secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true', path='/')


@router.post('/signup')
def signup(body: Credentials, request: Request, response: Response):
    throttle(request)
    email = body.email.strip().lower()
    if '@' not in email or '.' not in email.split('@')[-1] or not body.name.strip():
        raise HTTPException(400, 'Enter your name and a valid email address.')
    user = {'id': uuid4().hex, 'email': email, 'name': body.name.strip()}
    with connect() as db:
        if db.execute('SELECT 1 FROM users WHERE email=?', (email,)).fetchone():
            raise HTTPException(409, 'An account with this email already exists. Sign in instead.')
        db.execute('INSERT INTO users(id,email,name,password) VALUES (?,?,?,?)',
                   (user['id'], email, user['name'], password_hash(body.password)))
        db.execute('INSERT INTO accounts(user_id) VALUES (?)', (user['id'],))
        set_session(db, user['id'], response)
    return {'session': session_for(user)}


@router.post('/signin')
def signin(body: Credentials, request: Request, response: Response):
    throttle(request)
    with connect() as db:
        user = db.execute('SELECT * FROM users WHERE email=?', (body.email.strip().lower(),)).fetchone()
        # Do the same expensive password derivation for unknown accounts.
        encoded = user['password'] if user else '0' * 32 + ':' + '0' * 128
        salt = encoded.split(':')[0]
        if not hmac.compare_digest(password_hash(body.password, salt), encoded) or not user:
            raise HTTPException(401, 'Email or password is incorrect.')
        set_session(db, user['id'], response)
    return {'session': session_for(user)}


@router.get('/me')
def me(user=Depends(current_user)):
    return {'session': session_for(user)}


@router.post('/signout')
def signout(request: Request, response: Response):
    digest = hashlib.sha256(request.cookies.get(COOKIE, '').encode()).hexdigest()
    with connect() as db:
        db.execute('DELETE FROM sessions WHERE token_hash=?', (digest,))
    response.delete_cookie(COOKIE, path='/')
    return {'ok': True}

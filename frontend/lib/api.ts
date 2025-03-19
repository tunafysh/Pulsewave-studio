"use client"
// utils/api.js
import axios from 'axios';

const APIEndpoint = axios.create({
    baseURL: 'http://localhost:8000/api',
    withCredentials: false,
    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,PATCH,OPTIONS'
    }
});

export const getAllUsers = async () => {
    const response = await APIEndpoint.get('/users');
    return response.data;
};

export const createUser = async (name: string, password: string) => {
    const response = await APIEndpoint.post('/users', { name, password });
    return response.data;
};

export const updateUser = async (field: | 'name' | 'password', value: string) => {
    const response = await APIEndpoint.put('/users', { field, value });
    return response.data;
}

export const deleteUser = async (id: number) => {
    const response = await APIEndpoint.delete(`/users/${id}`);
    return response.data;
};

export const streamAudio = async () => {
    const response = await APIEndpoint.get('/audio');
    return response.data;
}

export const getAudioMetadata = async () => {
    const response = await APIEndpoint.get('/audio/data');
    return response.data;
}
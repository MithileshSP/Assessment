import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '2m', target: 500 }, // Ramp up to 500 users
        { duration: '5m', target: 500 }, // Stay at 500 for 5 mins
        { duration: '2m', target: 800 }, // Peak at 800 users
        { duration: '5m', target: 800 }, // Stay at 800 for 5 mins
        { duration: '2m', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<200'], // 95% of requests must be below 200ms
        http_req_failed: ['rate<0.01'],   // Fewer than 1% errors
    },
};

const BASE_URL = 'http://localhost:100/api'; // Proxied via Nginx on port 100

export default function () {
    // 1. Fetch Challenges (Read-heavy, Redis Cached)
    const challengesRes = http.get(`${BASE_URL}/challenges`);
    check(challengesRes, {
        'challenges status is 200': (r) => r.status === 200,
        'challenges returned data': (r) => r.json().length > 0,
    });

    sleep(Math.random() * 3 + 2); // Simulating student reading time (2-5s)

    // 2. Mock Submission (Write-heavy, BullMQ Queued)
    const payload = JSON.stringify({
        challengeId: 'html-task-1',
        userId: `student-${__VU}`, // Unique per virtual user
        code: {
            html: '<h1>Hello World</h1>',
            css: 'h1 { color: red; }',
            js: 'console.log("test");'
        }
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'x-stress-test-key': 'k6-stress-secret-2026',
            'x-stress-test-user-id': `student-${__VU}`
        },
    };

    const submitRes = http.post(`${BASE_URL}/submissions`, payload, params);
    check(submitRes, {
        'submission status is 202': (r) => r.status === 202,
        'submission queued': (r) => r.json().status === 'queued',
    });

    sleep(Math.random() * 5 + 5); // Wait before next action
}

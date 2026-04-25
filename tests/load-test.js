import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '10s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const res = http.get('http://20.166.194.10');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
export function getRandomData(key: string): string {
  const data = randomDictionary[key];

  if (data) {
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex];
  }
  return '**********';
}

const randomDictionary: Record<string, string[]> = {
  date: [
    '30 January 2019',
    '21 November 2020',
    '22 December 2021',
    '15 March 2017',
  ],
  time: ['4 p.m.', '9 a.m.'],
  domain: ['https://www.random.com', 'http://www.best.com'],
  email: ['abc123@example.com'],
  per: ['John Doe', 'Jane Smith', 'Robert Johnson', 'Emily Davis'],
  loc: ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX'],
  org: [
    'TechCorp Inc.',
    'GreenSolutions Ltd.',
    'Global Dynamics',
    'Urban Ventures',
  ],
  custom: ['**********'],
};

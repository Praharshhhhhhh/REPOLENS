-- SQL to create the repo_history table in Supabase
create table repo_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  repo_url text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table repo_history enable row level security;

-- Policy to allow users to select their own history
create policy "Users can view their own history."
  on repo_history for select
  using ( auth.uid() = user_id );

-- Policy to allow users to insert their own history
create policy "Users can insert their own history."
  on repo_history for insert
  with check ( auth.uid() = user_id );

-- Policy to allow users to delete their own history
create policy "Users can delete their own history."
  on repo_history for delete
  using ( auth.uid() = user_id );

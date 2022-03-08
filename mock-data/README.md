# MOCK DATA
This package adds mock data into the Faros CE allowing users to understand what the canned Faros CE metrics (especially DORA) will look like and insights they can get.

When you're ready to configure your own sources, you can delete the mock data.

## :checkered_flag: Quickstart

Running the script requires the Faros CE environment to be running. Follow our [🏁 Quickstart Guide](https://community.faros.ai/docs/quickstart) to get it running, if you already haven't.


Running the script:
```sh
$ npm i # Install all dependencies, only needed once.
```

### :bullettrain_side: Uploading mock data
```sh
$ ./bin/mock-data upload
```

Access the Welcome dashboard in [Metabase](http://localhost:3000/dashboard/1) on port 3000 to start exploring the mock data.

### :x: Deleting mock data
```sh
$ ./bin/mock-data delete
```
> :clipboard: Note: You can also optionally specify the Hasura service url using the `-u` flag. **If this flag is not
specified, the script will upload to the the default service url http://localhost:8080**

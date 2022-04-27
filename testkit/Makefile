clean:
	for i in `seq 0 3`; do rm -rf ./configs/node$${i}/simd/data; cp -R ./data ./configs/node$${i}/simd/; done;

start:
	docker-compose up -d

stop:
	docker-compose down --remove-orphans

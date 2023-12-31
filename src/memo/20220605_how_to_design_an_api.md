---
title: 设计一个查询接口，需要考虑什么
shortTitle: 设计一个查询接口，需要考虑什么
date: 2022-06-05
isOriginal: true
category:
  - 每周思考
tag:  
  - 后端开发
  - 设计
---

后端开发的日常就是写接口，其中查询接口较为普遍，那么设计一个查询接口，需要考虑什么？
<!--more-->
最基本的自然是功能实现的考虑，思考的是数据从哪来，而要满足上线标准，还得考虑性能、数据时效性以及服务可用性。

根据经验，总结了一份简单的checklist

- 是否C端接口，预估上线多少QPS，自己的接口处于调用链路的位置是什么
- 请求的特征是什么，时间上空间上，是分散的，还是集中的
- 是否需要缓存，如果需要，如何做缓存的更新
- 对数据时效性是否敏感，在一段时间内读到历史数据是否有影响
- 是否可能会有突发流量，遭遇突发流量是否需要限流，是否核心链路，是否允许降级

我的一个大原则是：KISS——Keep It Simple and Stupid，保持简单，只加必要逻辑

以粤康码的查询为例，假设数据都存储在MySQL，那么最简单的实现，自然是直接根据用户id，走索引读取MySQL里的核酸检测记录返回。

那这个设计符合上线标准吗？

#### 性能考虑

##### QPS预估

对于查询接口，做设计方案的第一步，都得做个简单的QPS预估。即便是第一次上线没有历史数据支撑，也要简单毛估。要对自己服务的请求量有个基本预期

假设一个城市100w人口，除去睡觉的8小时，剩下的16小时是57600秒，平均下来18QPS，但是粤康码的场景，存在明显的出行早晚高峰，其余时间请求量都比较零散，假设全民都在早高峰2小时内打开一次健康码，QPS算140 （一开始以为单个城市QPS都能上万，这样一算才发现原来没有我想象中的高，10倍的误差也是1400而已

整个广东省21个地级市，算3000QPS，考虑3倍误差，QPS估计也能上万。MySQL最高可支撑多少QPS取决于机器配置，而且也不能把容量全部占满不留余地，上万的量级，直觉就是不能让所有请求都打到同一个MySQL上

所以得进一步考虑

- 是否分数据库实例
- 是否用缓存

##### 是否分库

有些业务场景，在空间上就是分散的，例如外卖、同城等，广州的业务基本不会和深圳的业务有交叉，所以数据库可以独立部署，根据用户所在地理位置路由到对应的数据库中，可以降低同一个MySQL实例的请求量

对于粤康码，通常情况下存在跨城市流动的，如果按城市独立分库部署，广州的人出差到深圳10天，那这10天都得聚合两个数据库，这还没算上途径城市。所以按地理位置进行数据的划分，反而引入更大的复杂度，可以但没有必要

##### 是否用缓存

假设全省的数据都集中同一个库里，为了减少打到MySQL的请求，可以考虑上缓存

但是用户维度的缓存优化效果不太明显。一般来说，多个用户看到同一份数据，使用缓存可以大大减少下游的请求量，而每个用户只看自己数据的情况下，如果本身查询频率又低，例如每4个小时才查一次，如果缓存失效时间设置不够长，其实和直接请求MySQL没太大区别，

一旦用到缓存，那么就得考虑缓存的更新，[缓存更新的套路 | 酷 壳 - CoolShell](https://coolshell.cn/articles/17416.html) 里已经有很不错的总结了。那么在该场景下，最常见的还是Cache Aside的模式，先查询缓存，命中则返回，miss时去查询MySQL然后更新到缓存里；当数据更新时去把缓存里的数据删掉

此外，就和MySQL一样，如果用Redis做缓存，同样可能存在单点请求量过大的问题，如果QPS过大，为了减少单点压力，同样存在两种做法，一个是拆分Redis实例，一个是本地缓存，即把redis的数据缓存在进程中容器，组成多级缓存

用到缓存，还得考虑缓存击穿、缓存穿透、缓存雪崩等问题，当然这些问题，已经有很通用的解法了。所以不是特别必要，还是尽量少引入缓存，避免这些问题，处理不好就是灾难

#### 时效性考虑

既然请求量大，还有一种解法是读写分离，通过读从库减轻主库的压力，但不是所有的查询请求都能用从库分担压力的。只适合那种对时效性不敏感的请求，即便查到历史数据也没影响

主从同步都是会有延迟的，特别是大数据量的表，随便加一个字段，都有可能出现主从延迟，现象太普遍了。一旦延迟个几分钟，原本先写后读的逻辑就会读到历史数据，如果基于查询数据做处理就会出问题

最好是默认读主库，当主库实在扛不住压力的时候再把那些时效性不敏感的请求给转移到从库。当然如果一开始评估查询接口的时效性不敏感，也可以一步到位读从库。

总的来说就是要知道自己的接口查到历史数据会不会有问题

#### 服务可用性考虑

在第一步，已经做过了QPS预估，日常是没有问题的，那会不会有突发流量呢？粤康码场景，暂时还没想到，假设有的情况下。因为一般MySQL和Redis等中间件都是共用的（独占资源的另说），自己的接口挂了不要紧，最怕自己的接口突发流量占满了MySQL、Redis的资源，反而影响到了其他处于关键链路的服务可用性

如果存在突发流量的可能，出于服务保护，还是得考虑一些限流措施，甚至设置降级开关，关键时刻把自己的查询入口给关了。

限流以及降级的考虑，还得考虑自己的接口处于调用链路的位置，限流和降级对调用方都是有影响的

- 如果是直接面向前端的接口，影响可能只是用户请求变慢了
- 如果是提供给其他服务的RPC接口，一旦进行限流就会拖慢上游请求，是有可能出现连锁反应的

#### 小结

以上则是关于设计一个查询接口的考虑要素，关键还是两点

- QPS，涉及缓存架构、服务可用性
- 时效性，涉及业务逻辑的数据正确性



